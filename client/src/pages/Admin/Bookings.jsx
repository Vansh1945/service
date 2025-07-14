import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
    Search,
    Calendar,
    User,
    Clock,
    MapPin,
    Eye,
    Trash2,
    Download,
    CheckCircle,
    XCircle,
    AlertCircle,
    UserCheck,
    CreditCard,
    Wallet,
    Package,
    ChevronDown,
    ChevronUp,
    BarChart2,
    DollarSign,
    Users,
    Briefcase
} from 'lucide-react';

const AdminBookingsView = () => {
    const { token, API, showToast } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [groupedBookings, setGroupedBookings] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});
    const [providerDetails, setProviderDetails] = useState({});
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0
    });

    // Filter states
    const [filters, setFilters] = useState({
        status: '',
        customer: '',
        provider: '',
        service: '',
        from: '',
        to: '',
        search: ''
    });

    // Status options
    const statusOptions = [
        { value: '', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
    ];

    // Status colors
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'accepted': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Status icons
    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <AlertCircle className="w-4 h-4" />;
            case 'accepted': return <UserCheck className="w-4 h-4" />;
            case 'completed': return <CheckCircle className="w-4 h-4" />;
            case 'cancelled': return <XCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    // Toggle group expansion
    const toggleGroup = (transactionId) => {
        setExpandedGroups(prev => ({
            ...prev,
            [transactionId]: !prev[transactionId]
        }));
    };

    // Fetch provider details
    const fetchProviderDetails = async (providerId) => {
        try {
            if (!providerId || providerDetails[providerId]) return;

            const response = await fetch(`${API}/admin/providers/${providerId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch provider details');
            }

            const data = await response.json();
            setProviderDetails(prev => ({
                ...prev,
                [providerId]: data.provider || data.data // Handle different response structures
            }));
        } catch (error) {
            console.error('Error fetching provider details:', error);
            showToast('Failed to fetch provider details', 'error');
        }
    };

    // Group bookings by transaction
    const groupBookingsByTransaction = (bookings) => {
        const grouped = {};

        bookings.forEach(booking => {
            const transactionId = booking.transactionId || 'individual';

            if (!grouped[transactionId]) {
                grouped[transactionId] = {
                    transactionId,
                    paymentMethod: booking.paymentMethod,
                    totalAmount: 0,
                    bookings: [],
                    createdAt: booking.createdAt,
                    customer: booking.customer
                };
            }

            grouped[transactionId].bookings.push(booking);
            grouped[transactionId].totalAmount += booking.totalAmount || 0;

            // Fetch provider details for each booking
            if (booking.provider?._id) {
                fetchProviderDetails(booking.provider._id);
            }
        });

        return grouped;
    };

    // Calculate stats from bookings
    const calculateStats = (bookings) => {
        const stats = {
            total: bookings.length,
            pending: 0,
            accepted: 0,
            completed: 0,
            cancelled: 0,
            revenue: 0
        };

        bookings.forEach(booking => {
            stats[booking.status] += 1;
            if (booking.status === 'completed') {
                stats.revenue += booking.totalAmount || 0;
            }
        });

        return stats;
    };

    // Fetch bookings
    const fetchBookings = async () => {
        try {
            const queryParams = new URLSearchParams();

            Object.entries(filters).forEach(([key, value]) => {
                if (value && key !== 'search') {
                    queryParams.append(key, value);
                }
            });

            const response = await fetch(`${API}/booking/admin?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const data = await response.json();
            let filteredBookings = data.data || data.bookings || [];

            // Apply search filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                filteredBookings = filteredBookings.filter(booking =>
                    (booking.customer?.name?.toLowerCase().includes(searchTerm)) ||
                    (booking.provider?.name?.toLowerCase().includes(searchTerm)) ||
                    (booking.service?.title?.toLowerCase().includes(searchTerm)) ||
                    (booking._id.toLowerCase().includes(searchTerm)) ||
                    (booking.customer?.email?.toLowerCase().includes(searchTerm)) ||
                    (booking.provider?.email?.toLowerCase().includes(searchTerm)) ||
                    (booking.transactionId && booking.transactionId.toLowerCase().includes(searchTerm))
                );
            }

            setBookings(filteredBookings);
            setStats(calculateStats(filteredBookings));
            const grouped = groupBookingsByTransaction(filteredBookings);
            setGroupedBookings(grouped);

            // Initialize expanded state for all groups
            const initialExpanded = {};
            Object.keys(grouped).forEach(key => {
                initialExpanded[key] = true;
            });
            setExpandedGroups(initialExpanded);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast('Failed to fetch bookings', 'error');
        }
    };

    // Fetch booking details
    const fetchBookingDetails = async (bookingId) => {
        try {
            const response = await fetch(`${API}/booking/admin/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch booking details');
            }

            const data = await response.json();
            const bookingData = data.data || data.booking;
            setSelectedBooking(bookingData);

            // Fetch provider details when opening modal
            if (bookingData.provider?._id) {
                await fetchProviderDetails(bookingData.provider._id);
            }

            setShowModal(true);
        } catch (error) {
            console.error('Error fetching booking details:', error);
            showToast('Failed to fetch booking details', 'error');
        }
    };

    // Delete booking
    const deleteBooking = async (bookingId) => {
        try {
            const response = await fetch(`${API}/booking/admin/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete booking');
            }

            showToast('Booking deleted successfully');
            setDeleteConfirm(null);
            fetchBookings();
        } catch (error) {
            console.error('Error deleting booking:', error);
            showToast('Failed to delete booking', 'error');
        }
    };

    // Handle filter change
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({
            status: '',
            customer: '',
            provider: '',
            service: '',
            from: '',
            to: '',
            search: ''
        });
    };

    // Export bookings
    const exportBookings = () => {
        const headers = [
            'Booking ID',
            'Customer Name',
            'Customer Email',
            'Customer Phone',
            'Provider Name',
            'Provider Email',
            'Provider Phone',
            'Provider Experience',
            'Service Title',
            'Service Category',
            'Service Description',
            'Booking Date',
            'Booking Time',
            'Status',
            'Street Address',
            'City',
            'Postal Code',
            'State',
            'Country',
            'Transaction ID',
            'Payment Method',
            'Payment Status',
            'Coupon Applied',
            'Discount Amount',
            'Total Amount',
            'Created At',
            'Updated At'
        ];

        // Helper function to format currency without symbol for CSV
        const formatCurrencyForCSV = (amount) => {
            if (!amount) return '0.00';
            return new Intl.NumberFormat('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        };

        const rows = bookings.map(booking => {
            const providerExp = providerDetails[booking.provider?._id]?.experience || 'N/A';

            return [
                booking._id,
                booking.customer?.name || 'N/A',
                booking.customer?.email || 'N/A',
                booking.customer?.phone || 'N/A',
                booking.provider?.name || 'N/A',
                booking.provider?.email || 'N/A',
                booking.provider?.phone || 'N/A',
                providerExp !== 'N/A' ? `${providerExp} ${providerExp === 1 ? 'year' : 'years'}` : 'N/A',
                booking.service?.title || 'N/A',
                booking.service?.category || 'N/A',
                booking.service?.description || 'N/A',
                formatDate(booking.date),
                booking.time || 'N/A',
                booking.status,
                booking.address?.street || 'N/A',
                booking.address?.city || 'N/A',
                booking.address?.postalCode || 'N/A',
                booking.address?.state || 'N/A',
                booking.address?.country || 'N/A',
                booking.transactionId || 'N/A',
                booking.paymentMethod || 'N/A',
                booking.paymentStatus || 'N/A',
                booking.couponApplied || 'N/A',
                booking.discountAmount ? formatCurrencyForCSV(booking.discountAmount) : 'N/A',
                formatCurrencyForCSV(booking.totalAmount),
                new Date(booking.createdAt).toLocaleString(),
                booking.updatedAt ? new Date(booking.updatedAt).toLocaleString() : 'N/A'
            ];
        });

        // Add BOM (Byte Order Mark) for UTF-8 encoding
        const BOM = "\uFEFF";
        const csvContent = BOM + [headers, ...rows]
            .map(row => row.map(field => {
                // Escape fields that might contain commas or quotes
                if (typeof field === 'string') {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            }).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Bookings exported successfully', 'success');
    };

    useEffect(() => {
        fetchBookings();
    }, [filters]);

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatTime = (time) => {
        if (!time) return 'N/A';
        return time;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const getPaymentMethodIcon = (method) => {
        switch (method?.toLowerCase()) {
            case 'credit card': return <CreditCard className="w-4 h-4 mr-1" />;
            case 'wallet': return <Wallet className="w-4 h-4 mr-1" />;
            case 'upi': return <Wallet className="w-4 h-4 mr-1" />;
            default: return <CreditCard className="w-4 h-4 mr-1" />;
        }
    };

    return (
        <div className="p-4 md:p-8 bg-blue-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-blue-900">Bookings Management</h1>
                            <p className="text-gray-600 mt-1">View and manage all system bookings</p>
                        </div>
                        <button
                            onClick={exportBookings}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-900 transition-colors"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div className="flex items-center">
                                <BarChart2 className="w-6 h-6 text-blue-600 mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600">Total Bookings</p>
                                    <p className="text-xl font-bold text-blue-900">{stats.total}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <div className="flex items-center">
                                <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600">Pending</p>
                                    <p className="text-xl font-bold text-yellow-800">{stats.pending}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <div className="flex items-center">
                                <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600">Completed</p>
                                    <p className="text-xl font-bold text-green-800">{stats.completed}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <div className="flex items-center">
                                <DollarSign className="w-6 h-6 text-indigo-600 mr-3" />
                                <div>
                                    <p className="text-sm text-gray-600">Total Revenue</p>
                                    <p className="text-xl font-bold text-indigo-800">{formatCurrency(stats.revenue)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search bookings..."
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {statusOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                            <input
                                type="date"
                                value={filters.from}
                                onChange={(e) => handleFilterChange('from', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                            <input
                                type="date"
                                value={filters.to}
                                onChange={(e) => handleFilterChange('to', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            Showing {bookings.length} bookings
                        </div>
                        <button
                            onClick={clearFilters}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                {/* Bookings Table */}
                <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
                    {bookings.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
                            <p className="text-gray-600">Try adjusting your filters or search terms.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                            Booking ID
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell">
                                            Provider
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                            Service
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell">
                                            Date & Time
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {Object.values(groupedBookings).map((group) => (
                                        <React.Fragment key={group.transactionId}>
                                            {/* Group Header */}
                                            {group.bookings.length > 1 && (
                                                <tr
                                                    className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                                                    onClick={() => toggleGroup(group.transactionId)}
                                                >
                                                    <td colSpan="7" className="px-4 py-3">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center">
                                                                {expandedGroups[group.transactionId] ? (
                                                                    <ChevronUp className="w-4 h-4 mr-2 text-blue-600" />
                                                                ) : (
                                                                    <ChevronDown className="w-4 h-4 mr-2 text-blue-600" />
                                                                )}
                                                                <div className="flex items-center text-sm text-blue-900">
                                                                    <Package className="w-4 h-4 mr-2" />
                                                                    <span className="font-medium">Group Booking ({group.bookings.length} services)</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-4">
                                                                <div className="flex items-center text-sm text-blue-900">
                                                                    <CreditCard className="w-4 h-4 mr-2" />
                                                                    <span className="font-medium">Transaction:</span>
                                                                    <span className="ml-2 font-mono">{group.transactionId}</span>
                                                                </div>
                                                                <div className="flex items-center text-sm text-blue-900">
                                                                    <span className="font-medium">Total:</span>
                                                                    <span className="ml-2 font-bold">{formatCurrency(group.totalAmount)}</span>
                                                                </div>
                                                                <div className="flex items-center text-sm text-blue-900">
                                                                    {getPaymentMethodIcon(group.paymentMethod)}
                                                                    <span className="capitalize">{group.paymentMethod || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Group Bookings */}
                                            {expandedGroups[group.transactionId] && group.bookings.map((booking) => (
                                                <tr key={booking._id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-blue-900">
                                                            {booking._id.slice(-8)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <User className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                            <div className="ml-3">
                                                                <div className="text-sm font-medium text-blue-900">
                                                                    {booking.customer?.name || 'N/A'}
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    {booking.customer?.email || 'N/A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <User className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                            <div className="ml-3">
                                                                <div className="text-sm font-medium text-blue-900">
                                                                    {booking.provider?.name || 'N/A'}
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    {booking.provider?.email || 'N/A'}
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {booking.provider?.phone || 'N/A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-blue-900">
                                                            {booking.service?.title || 'N/A'}
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {booking.service?.category || 'N/A'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {formatCurrency(booking.totalAmount)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                                                        <div className="flex items-center text-sm text-blue-900">
                                                            <Calendar className="w-4 h-4 mr-1" />
                                                            {formatDate(booking.date)}
                                                        </div>
                                                        {booking.time && (
                                                            <div className="flex items-center text-sm text-gray-600">
                                                                <Clock className="w-4 h-4 mr-1" />
                                                                {formatTime(booking.time)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                                            {getStatusIcon(booking.status)}
                                                            <span className="ml-1 capitalize">{booking.status}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => fetchBookingDetails(booking._id)}
                                                                className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            {booking.status === 'pending' && (
                                                                <button
                                                                    onClick={() => setDeleteConfirm(booking._id)}
                                                                    className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                                    title="Delete Booking"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Booking Details Modal */}
                {showModal && selectedBooking && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-blue-900">Booking Details</h2>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Booking Info */}
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Booking Information</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-gray-600">Booking ID</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking._id}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Date</p>
                                                    <p className="font-medium text-blue-900">{formatDate(selectedBooking.date)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Time</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.time || 'Not specified'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Status</p>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>
                                                        {getStatusIcon(selectedBooking.status)}
                                                        <span className="ml-1 capitalize">{selectedBooking.status}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Customer Info */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Customer Information</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-gray-600">Name</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Email</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.email}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Phone</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.phone}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Service & Address */}
                                    <div className="space-y-4">
                                        {/* Service Info */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Service Information</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-gray-600">Service</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.title}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Category</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.category}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Description</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.description}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Price</p>
                                                    <p className="font-medium text-blue-900">{formatCurrency(selectedBooking.totalAmount)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Provider Info */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Provider Information</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-gray-600">Name</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.provider?.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Email</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.provider?.email}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Phone</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.provider?.phone}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Experience</p>
                                                    <p className="font-medium text-blue-900">
                                                        {providerDetails[selectedBooking.provider?._id]?.experience || 'N/A'} {providerDetails[selectedBooking.provider?._id]?.experience === 1 ? 'year' : 'years'}
                                                    </p>
                                                </div>
                                                {providerDetails[selectedBooking.provider?._id]?.skills && (
                                                    <div>
                                                        <p className="text-sm text-gray-600">Skills</p>
                                                        <p className="font-medium text-blue-900">
                                                            {providerDetails[selectedBooking.provider?._id]?.skills.join(', ')}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Service Address</h3>
                                            <div className="flex items-start">
                                                <MapPin className="w-4 h-4 mt-1 mr-2 text-blue-600" />
                                                <div>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.street}</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.city}, {selectedBooking.address?.postalCode}</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.state}, {selectedBooking.address?.country}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Info */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Payment Information</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm text-gray-600">Payment Method</p>
                                                    <div className="flex items-center">
                                                        {getPaymentMethodIcon(selectedBooking.paymentMethod)}
                                                        <span className="font-medium text-blue-900 capitalize">{selectedBooking.paymentMethod || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Payment Status</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.paymentStatus || 'N/A'}</p>
                                                </div>
                                                {selectedBooking.transactionId && (
                                                    <div>
                                                        <p className="text-sm text-gray-600">Transaction ID</p>
                                                        <p className="font-medium text-blue-900">{selectedBooking.transactionId}</p>
                                                    </div>
                                                )}
                                                {selectedBooking.couponApplied && (
                                                    <div>
                                                        <p className="text-sm text-gray-600">Coupon Applied</p>
                                                        <p className="font-medium text-blue-900">{selectedBooking.couponApplied}</p>
                                                    </div>
                                                )}
                                                {selectedBooking.discountAmount > 0 && (
                                                    <div>
                                                        <p className="text-sm text-gray-600">Discount</p>
                                                        <p className="font-medium text-blue-900">{formatCurrency(selectedBooking.discountAmount)}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Amount</p>
                                                    <p className="font-bold text-blue-900">{formatCurrency(selectedBooking.totalAmount)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <div className="flex items-center mb-4">
                                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                                <h3 className="text-lg font-semibold text-blue-900">Confirm Deletion</h3>
                            </div>
                            <p className="text-gray-700 mb-6">
                                Are you sure you want to delete this booking? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteBooking(deleteConfirm)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminBookingsView;