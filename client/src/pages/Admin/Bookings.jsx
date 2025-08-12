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
    ChevronDown,
    ChevronUp,
    BarChart2,
    DollarSign,
    Users,
    Briefcase,
    Edit,
    UserPlus,
    RefreshCw
} from 'lucide-react';

const AdminBookingsView = () => {
    const { token, API, showToast } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0
    });
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

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

    // Fetch all providers
    const fetchProviders = async () => {
        try {
            const response = await fetch(`${API}/admin/providers`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch providers');
            }

            const data = await response.json();
            setProviders(data.providers || data.data || []);
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast('Failed to fetch providers', 'error');
        }
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
            if (booking.status) {
                stats[booking.status] += 1;
            }
            if (booking.status === 'completed' || booking.status === 'accepted') {
                stats.revenue += booking.totalAmount || 0;
            }
        });

        return stats;
    };

    // Fetch bookings
    const fetchBookings = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();

            // Only add filters that have values
            Object.entries(filters).forEach(([key, value]) => {
                if (value && value.trim() !== '') {
                    queryParams.append(key, value);
                }
            });

            const response = await fetch(`${API}/booking/admin/bookings?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const data = await response.json();
            let filteredBookings = Array.isArray(data.data) ? data.data : 
                                Array.isArray(data.bookings) ? data.bookings : [];

            // Apply search filter if it exists
            if (filters.search && filters.search.trim() !== '') {
                const searchTerm = filters.search.toLowerCase();
                filteredBookings = filteredBookings.filter(booking => {
                    const bookingId = booking._id || '';
                    const customerName = booking.customer?.name || '';
                    const providerName = booking.provider?.businessName || booking.provider?.name || '';
                    const serviceTitle = booking.service?.title || '';
                    const customerEmail = booking.customer?.email || '';
                    const providerEmail = booking.provider?.email || '';
                    
                    return (
                        customerName.toLowerCase().includes(searchTerm) ||
                        providerName.toLowerCase().includes(searchTerm) ||
                        serviceTitle.toLowerCase().includes(searchTerm) ||
                        bookingId.toLowerCase().includes(searchTerm) ||
                        customerEmail.toLowerCase().includes(searchTerm) ||
                        providerEmail.toLowerCase().includes(searchTerm)
                    );
                });
            }

            setBookings(filteredBookings);
            setStats(calculateStats(filteredBookings));
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast('Failed to fetch bookings', 'error');
        } finally {
            setLoading(false);
            if (initialLoad) setInitialLoad(false);
        }
    };

    // Fetch booking details
    const fetchBookingDetails = async (bookingId) => {
        try {
            setLoading(true);
            const response = await fetch(`${API}/booking/bookings/${bookingId}`, {
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
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching booking details:', error);
            showToast('Failed to fetch booking details', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Delete booking
    const deleteBooking = async (bookingId) => {
        try {
            setLoading(true);
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

            showToast('Booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
        } catch (error) {
            console.error('Error deleting booking:', error);
            showToast('Failed to delete booking', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Delete user booking
    const deleteUserBooking = async (userId, bookingId) => {
        try {
            setLoading(true);
            const response = await fetch(`${API}/booking/admin/user/${userId}/booking/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete user booking');
            }

            showToast('User booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
        } catch (error) {
            console.error('Error deleting user booking:', error);
            showToast('Failed to delete user booking', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Assign provider to booking
    const assignProvider = async (bookingId, providerId) => {
        try {
            setLoading(true);
            const response = await fetch(`${API}/booking/admin/${bookingId}/assign`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ providerId })
            });

            if (!response.ok) {
                throw new Error('Failed to assign provider');
            }

            showToast('Provider assigned successfully', 'success');
            fetchBookings();
            if (selectedBooking) {
                fetchBookingDetails(selectedBooking._id);
            }
        } catch (error) {
            console.error('Error assigning provider:', error);
            showToast('Failed to assign provider', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Reschedule booking
    const rescheduleBooking = async (bookingId, newDate, newTime) => {
        try {
            setLoading(true);
            const response = await fetch(`${API}/booking/admin/${bookingId}/reschedule`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date: newDate, time: newTime })
            });

            if (!response.ok) {
                throw new Error('Failed to reschedule booking');
            }

            showToast('Booking rescheduled successfully', 'success');
            fetchBookings();
            if (selectedBooking) {
                fetchBookingDetails(selectedBooking._id);
            }
            setShowModal(false);
        } catch (error) {
            console.error('Error rescheduling booking:', error);
            showToast('Failed to reschedule booking', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle filter change with debounce
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
            'Service Title',
            'Service Category',
            'Booking Date',
            'Booking Time',
            'Status',
            'Street Address',
            'City',
            'Postal Code',
            'State',
            'Country',
            'Payment Method',
            'Payment Status',
            'Coupon Applied',
            'Discount Amount',
            'Total Amount',
            'Created At'
        ];

        const rows = bookings.map(booking => {
            return [
                booking._id || 'N/A',
                booking.customer?.name || 'N/A',
                booking.customer?.email || 'N/A',
                booking.customer?.phone || 'N/A',
                booking.provider?.businessName || booking.provider?.name || 'N/A',
                booking.provider?.email || 'N/A',
                booking.provider?.phone || 'N/A',
                booking.service?.title || 'N/A',
                booking.service?.category || 'N/A',
                formatDate(booking.date),
                booking.time || 'N/A',
                booking.status || 'N/A',
                booking.address?.street || 'N/A',
                booking.address?.city || 'N/A',
                booking.address?.postalCode || 'N/A',
                booking.address?.state || 'N/A',
                booking.address?.country || 'N/A',
                booking.paymentMethod || 'N/A',
                booking.paymentStatus || 'N/A',
                booking.couponApplied || 'N/A',
                booking.discountAmount || '0.00',
                booking.totalAmount || '0.00',
                booking.createdAt ? new Date(booking.createdAt).toLocaleString() : 'N/A'
            ];
        });

        // Add BOM (Byte Order Mark) for UTF-8 encoding
        const BOM = "\uFEFF";
        const csvContent = BOM + [headers, ...rows]
            .map(row => row.map(field => {
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

    // Debounce filter changes to avoid too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!initialLoad) {
                fetchBookings();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        fetchBookings();
        fetchProviders();
    }, []);

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
            case 'wallet': return <Briefcase className="w-4 h-4 mr-1" />;
            case 'upi': return <Briefcase className="w-4 h-4 mr-1" />;
            case 'cash': return <DollarSign className="w-4 h-4 mr-1" />;
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
                            <h1 className="text-2xl font-bold text-blue-900">Admin Bookings Management</h1>
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
                    {loading && initialLoad ? (
                        <div className="text-center py-12">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Loading bookings...</p>
                        </div>
                    ) : bookings.length === 0 ? (
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
                                    {bookings.map((booking) => (
                                        <tr key={booking._id || Math.random().toString(36).substr(2, 9)} className="hover:bg-blue-50 transition-colors">
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-blue-900">
                                                    {booking._id ? booking._id.substring(booking._id.length - 8) : 'N/A'}
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
                                                            {booking.provider?.businessName || booking.provider?.name || 'Unassigned'}
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {booking.provider?.email || 'N/A'}
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
                                                    <span className="ml-1 capitalize">{booking.status || 'N/A'}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => booking._id && fetchBookingDetails(booking._id)}
                                                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {booking.status === 'pending' && booking._id && (
                                                        <button
                                                            onClick={() => setDeleteConfirm({
                                                                id: booking._id,
                                                                userId: booking.customer?._id
                                                            })}
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
                                                    <p className="font-medium text-blue-900">{selectedBooking._id || 'N/A'}</p>
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
                                                        <span className="ml-1 capitalize">{selectedBooking.status || 'N/A'}</span>
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
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Email</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Phone</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">User ID</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.customer?._id || 'N/A'}</p>
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
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.title || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Category</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.category || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Description</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.service?.description || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-600">Price</p>
                                                    <p className="font-medium text-blue-900">{formatCurrency(selectedBooking.totalAmount)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Provider Assignment */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Provider Assignment</h3>
                                            {selectedBooking.provider ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Current Provider</p>
                                                        <p className="font-medium text-blue-900">{selectedBooking.provider.businessName || selectedBooking.provider.name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Email</p>
                                                        <p className="font-medium text-blue-900">{selectedBooking.provider.email || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Phone</p>
                                                        <p className="font-medium text-blue-900">{selectedBooking.provider.phone || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-600">No provider assigned yet</p>
                                            )}
                                            
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Assign New Provider</label>
                                                <select
                                                    onChange={(e) => selectedBooking._id && assignProvider(selectedBooking._id, e.target.value)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select a provider</option>
                                                    {providers.map(provider => (
                                                        <option key={provider._id} value={provider._id}>
                                                            {provider.businessName || provider.name} ({provider.email})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Service Address</h3>
                                            <div className="flex items-start">
                                                <MapPin className="w-4 h-4 mt-1 mr-2 text-blue-600" />
                                                <div>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.street || 'N/A'}</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.city || 'N/A'}, {selectedBooking.address?.postalCode || 'N/A'}</p>
                                                    <p className="font-medium text-blue-900">{selectedBooking.address?.state || 'N/A'}, {selectedBooking.address?.country || 'N/A'}</p>
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

                                        {/* Reschedule Booking */}
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                            <h3 className="font-semibold text-blue-900 mb-3">Reschedule Booking</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                                                    <input
                                                        type="date"
                                                        id="newDate"
                                                        min={new Date().toISOString().split('T')[0]}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                                                    <input
                                                        type="time"
                                                        id="newTime"
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newDate = document.getElementById('newDate').value;
                                                    const newTime = document.getElementById('newTime').value;
                                                    if (newDate && selectedBooking._id) {
                                                        rescheduleBooking(selectedBooking._id, newDate, newTime);
                                                    } else {
                                                        showToast('Please select a new date', 'error');
                                                    }
                                                }}
                                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <Edit className="w-4 h-4 mr-2 inline" />
                                                Reschedule Booking
                                            </button>
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
                                    onClick={() => {
                                        if (deleteConfirm.userId && deleteConfirm.id) {
                                            deleteUserBooking(deleteConfirm.userId, deleteConfirm.id);
                                        } else if (deleteConfirm.id) {
                                            deleteBooking(deleteConfirm.id);
                                        }
                                    }}
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