import React, { useState, useEffect, useMemo } from 'react';
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
    ChevronRight
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
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showAssignProviderModal, setShowAssignProviderModal] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        status: '',
        startDate: '',
        endDate: '',
        search: '',
        paymentStatus: ''
    });

    // Pagination state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    // Status options
    const statusOptions = [
        { value: '', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
    ];

    // Payment status options
    const paymentStatusOptions = [
        { value: '', label: 'All Payment Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'paid', label: 'Paid' },
        { value: 'failed', label: 'Failed' },
        { value: 'refunded', label: 'Refunded' }
    ];

    // Enhanced status colors with transparent backgrounds
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
            case 'accepted': return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'in-progress': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
            case 'completed': return 'bg-green-50 text-green-800 border-green-200';
            case 'cancelled': return 'bg-red-50 text-red-800 border-red-200';
            default: return 'bg-gray-50 text-gray-800 border-gray-200';
        }
    };

    // Status icons
    const getStatusIcon = (status) => {
        const baseClass = "w-4 h-4";
        switch (status) {
            case 'pending': return <AlertCircle className={baseClass} />;
            case 'accepted': return <UserCheck className={baseClass} />;
            case 'in-progress': return <Activity className={baseClass} />;
            case 'completed': return <CheckCircle className={baseClass} />;
            case 'cancelled': return <XCircle className={baseClass} />;
            default: return <AlertCircle className={baseClass} />;
        }
    };

    // Fetch all providers for assignment
    const fetchProviders = async () => {
        try {
            const response = await fetch(`${API}/admin/providers`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setProviders(data.providers || data.data || []);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch providers');
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast(error.message, 'error');
        }
    };

    // Fetch bookings with filters and pagination
    const fetchBookings = async () => {
        try {
            setLoading(true);
            
            const queryParams = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString()
            });

            // Add filters
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.paymentStatus) queryParams.append('paymentStatus', filters.paymentStatus);

            const response = await fetch(`${API}/booking/admin/bookings?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const fetchedBookings = data.data || [];
                
                setBookings(fetchedBookings);
                setPagination(prev => ({
                    ...prev,
                    total: data.total || 0,
                    pages: data.pages || 1
                }));

                // Calculate stats
                calculateStats(fetchedBookings);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch bookings');
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Calculate statistics
    const calculateStats = (bookingsData) => {
        const newStats = {
            total: bookingsData.length,
            pending: 0,
            accepted: 0,
            completed: 0,
            cancelled: 0,
            revenue: 0
        };

        bookingsData.forEach(booking => {
            if (booking.status) {
                newStats[booking.status] = (newStats[booking.status] || 0) + 1;
            }
            if (booking.status === 'completed' && booking.paymentStatus === 'paid') {
                newStats.revenue += booking.totalAmount || 0;
            }
        });

        setStats(newStats);
    };

    // Fetch booking details
    const fetchBookingDetails = async (bookingId) => {
        try {
            setActionLoading(true);
            const response = await fetch(`${API}/booking/bookings/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedBooking(data.data);
                setShowModal(true);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch booking details');
            }
        } catch (error) {
            console.error('Error fetching booking details:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Delete booking
    const handleDeleteBooking = async (bookingId) => {
        try {
            setActionLoading(true);
            const response = await fetch(`${API}/booking/admin/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                showToast('Booking deleted successfully', 'success');
                setDeleteConfirm(null);
                fetchBookings();
                setShowModal(false);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete booking');
            }
        } catch (error) {
            console.error('Error deleting booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Delete user booking
    const handleDeleteUserBooking = async (userId, bookingId) => {
        try {
            setActionLoading(true);
            const response = await fetch(`${API}/booking/admin/user/${userId}/booking/${bookingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                showToast('User booking deleted successfully', 'success');
                setDeleteConfirm(null);
                fetchBookings();
                setShowModal(false);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete user booking');
            }
        } catch (error) {
            console.error('Error deleting user booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Assign provider to booking
    const handleAssignProvider = async (bookingId, providerId) => {
        try {
            setActionLoading(true);
            const response = await fetch(`${API}/booking/admin/${bookingId}/assign`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ providerId })
            });

            if (response.ok) {
                showToast('Provider assigned successfully', 'success');
                fetchBookings();
                setShowAssignProviderModal(false);
                if (selectedBooking) {
                    fetchBookingDetails(selectedBooking._id);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to assign provider');
            }
        } catch (error) {
            console.error('Error assigning provider:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Reschedule booking
    const handleRescheduleBooking = async (bookingId, newDate, newTime) => {
        try {
            setActionLoading(true);
            const body = {};
            if (newDate) body.date = newDate;
            if (newTime) body.time = newTime;

            const response = await fetch(`${API}/booking/admin/${bookingId}/reschedule`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                showToast('Booking rescheduled successfully', 'success');
                fetchBookings();
                setShowRescheduleModal(false);
                setShowModal(false);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to reschedule booking');
            }
        } catch (error) {
            console.error('Error rescheduling booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Download booking report
    const handleDownloadReport = async () => {
        if (!filters.startDate || !filters.endDate) {
            showToast('Please select a date range to export the report.', 'error');
            return;
        }
        try {
            setActionLoading(true);
            const queryParams = new URLSearchParams();
            
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);

            const response = await fetch(`${API}/booking/admin/booking-report?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `booking_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showToast('Report downloaded successfully', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to download report');
            }
        } catch (error) {
            console.error('Error downloading report:', error);
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

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            status: '',
            startDate: '',
            endDate: '',
            search: '',
            paymentStatus: ''
        });
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
            day: 'numeric'
        });
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    // Filter providers by service location match
    const getFilteredProviders = (booking) => {
        if (!booking || !booking.address) return providers;
        
        return providers.filter(provider => {
            const providerCity = provider.serviceLocation?.city || provider.city || '';
            const bookingCity = booking.address?.city || '';
            
            return providerCity.toLowerCase().includes(bookingCity.toLowerCase()) || 
                   bookingCity.toLowerCase().includes(providerCity.toLowerCase());
        });
    };

    // Memoized filtered bookings count
    const filteredBookingsCount = useMemo(() => {
        return bookings.length;
    }, [bookings]);

    // Fetch data on component mount and when filters/pagination change
    useEffect(() => {
        fetchBookings();
        fetchProviders();
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
        <div className="min-h-screen  p-4 md:p-6">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-secondary mb-2">Bookings Management</h1>
                <p className="text-gray-600">Manage and monitor all bookings in the system</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Bookings</p>
                            <p className="text-2xl font-bold text-secondary">{stats.total}</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-full">
                            <BarChart2 className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded-full">
                            <AlertCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-full">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Revenue</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.revenue)}</p>
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
                            onClick={clearFilters}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search bookings..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Payment Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                        <select
                            value={filters.paymentStatus}
                            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {paymentStatusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filters Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                    {filters.status && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Status: {statusOptions.find(s => s.value === filters.status)?.label}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('status', '')} />
                        </span>
                    )}
                    {filters.paymentStatus && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Payment: {paymentStatusOptions.find(p => p.value === filters.paymentStatus)?.label}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('paymentStatus', '')} />
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

            {/* Bookings Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-semibold text-secondary">All Bookings</h3>
                        <p className="text-sm text-gray-600">
                            Showing {filteredBookingsCount} of {pagination.total} bookings
                        </p>
                    </div>
                    <button
                        onClick={handleDownloadReport}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Booking ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                    Provider
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Service & Amount
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                                    Date & Time
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
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
                                        <td className="px-4 py-4 hidden md:table-cell">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                                        </td>
                                        <td className="px-4 py-4 hidden lg:table-cell">
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-8 bg-gray-200 rounded w-20"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : bookings.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                        <p>No bookings found</p>
                                        <p className="text-sm">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                bookings.map((booking) => (
                                    <tr key={booking._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-secondary">
                                                #{booking._id?.substring(booking._id.length - 8) || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-secondary">
                                                    {booking.customer?.name || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {booking.customer?.email || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                                            <div>
                                                <div className="text-sm font-medium text-secondary">
                                                    {booking.provider?.name || 'Unassigned'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {booking.provider?.email || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-secondary">
                                                    {booking.services?.[0]?.service?.title || 'N/A'}
                                                </div>
                                                <div className="text-sm font-bold text-primary">
                                                    {formatCurrency(booking.totalAmount)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div>
                                                <div className="text-sm text-secondary">
                                                    {formatDate(booking.date)}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {booking.time || 'Not specified'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                                                {getStatusIcon(booking.status)}
                                                <span className="ml-1 capitalize">{booking.status}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => fetchBookingDetails(booking._id)}
                                                    className="p-1 text-primary hover:text-teal-700"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setSelectedBooking(booking);
                                                        setShowRescheduleModal(true);
                                                    }}
                                                    className="p-1 text-blue-600 hover:text-blue-800"
                                                    title="Update Date/Time"
                                                >
                                                    <Calendar className="w-4 h-4" />
                                                </button>

                                                {booking.status === 'pending' && !booking.provider && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBooking(booking);
                                                            setShowAssignProviderModal(true);
                                                        }}
                                                        className="p-1 text-green-600 hover:text-green-800"
                                                        title="Assign Provider"
                                                    >
                                                        <UserCheck className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => setDeleteConfirm({
                                                        id: booking._id,
                                                        userId: booking.customer?._id,
                                                        type: 'booking'
                                                    })}
                                                    className="p-1 text-red-600 hover:text-red-800"
                                                    title="Delete Booking"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Booking Details Modal */}
            {showModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-secondary">Booking Details</h2>
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
                                    {/* Booking Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Booking Information</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm text-gray-600">Booking ID:</span>
                                                <p className="font-medium">{selectedBooking.booking._id}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Date:</span>
                                                <p className="font-medium">{formatDate(selectedBooking.booking.date)}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Time:</span>
                                                <p className="font-medium">{selectedBooking.booking.time || 'Not specified'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Status:</span>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.booking.status)}`}>
                                                    {getStatusIcon(selectedBooking.booking.status)}
                                                    <span className="ml-1 capitalize">{selectedBooking.booking.status}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Customer Information</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm text-gray-600">Name:</span>
                                                <p className="font-medium">{selectedBooking.customer?.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Email:</span>
                                                <p className="font-medium">{selectedBooking.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Phone:</span>
                                                <p className="font-medium">{selectedBooking.customer?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Provider Information */}
                                    {selectedBooking.provider && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <h3 className="font-semibold text-secondary mb-3">Provider Information</h3>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-sm text-gray-600">Business Name:</span>
                                                    <p className="font-medium">{selectedBooking.provider.businessName || selectedBooking.provider.name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Email:</span>
                                                    <p className="font-medium">{selectedBooking.provider.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Phone:</span>
                                                    <p className="font-medium">{selectedBooking.provider.phone || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Service Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Service Information</h3>
                                        {selectedBooking.services?.map((serviceItem, index) => (
                                            <div key={index} className="mb-3 last:mb-0">
                                                <div className="font-medium">{serviceItem.service?.title || 'N/A'}</div>
                                                <div className="text-sm text-gray-600">
                                                    Category: {serviceItem.service?.category || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Quantity: {serviceItem.quantity || 1}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Price: {formatCurrency(serviceItem.price)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-4">
                                    {/* Address Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Service Address</h3>
                                        <div className="space-y-1">
                                            <p className="font-medium">{selectedBooking.booking.address?.street}</p>
                                            <p className="text-sm text-gray-600">
                                                {selectedBooking.booking.address?.city}, {selectedBooking.booking.address?.postalCode}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {selectedBooking.booking.address?.state}, {selectedBooking.booking.address?.country}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Payment Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Payment Breakdown</h3>
                                        <div className="space-y-2">
                                            {selectedBooking.services?.map((item, index) => (
                                                <div key={index} className="flex justify-between">
                                                    <span className="text-sm text-gray-600">{item.service?.title} (Qty: {item.quantity})</span>
                                                    <span className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-gray-200 my-2"></div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Subtotal</span>
                                                <span className="text-sm font-medium">{formatCurrency(selectedBooking.payment.subtotal)}</span>
                                            </div>
                                            {selectedBooking.payment.couponApplied && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Discount ({selectedBooking.payment.couponApplied.code})</span>
                                                    <span className="text-sm font-medium text-red-500">- {formatCurrency(selectedBooking.payment.totalDiscount)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-200 my-2"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-secondary">Total Amount Paid</span>
                                                <span className="font-bold text-primary text-lg">{formatCurrency(selectedBooking.payment.totalAmount)}</span>
                                            </div>
                                            <div className="pt-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Payment Method:</span>
                                                    <span className="text-sm font-medium capitalize">{selectedBooking.payment?.method || 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Payment Status:</span>
                                                    <span className="text-sm font-medium capitalize">{selectedBooking.payment?.status || 'N/A'}</span>
                                                </div>
                                                {selectedBooking.payment.details?.transactionId && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-gray-600">Transaction ID:</span>
                                                        <span className="text-sm font-medium">{selectedBooking.payment.details.transactionId}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Booking Status Flow */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Booking Status Flow</h3>
                                        <ul className="space-y-4">
                                            <li className="flex items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedBooking.booking.statusHistory?.find(h => h.status === 'accepted') ? 'bg-green-50' : 'bg-gray-50'}`}>
                                                    <CheckCircle className={`w-5 h-5 ${selectedBooking.booking.statusHistory?.find(h => h.status === 'accepted') ? 'text-green-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="ml-4">
                                                    <p className="font-medium">Booking Accepted</p>
                                                    <p className="text-sm text-gray-500">
                                                        {selectedBooking.booking.statusHistory?.find(h => h.status === 'accepted') ? new Date(selectedBooking.booking.statusHistory.find(h => h.status === 'accepted').timestamp).toLocaleString() : 'Pending'}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedBooking.booking.serviceStartedAt ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                                    <Activity className={`w-5 h-5 ${selectedBooking.booking.serviceStartedAt ? 'text-blue-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="ml-4">
                                                    <p className="font-medium">Service Started</p>
                                                    <p className="text-sm text-gray-500">
                                                        {selectedBooking.booking.serviceStartedAt ? new Date(selectedBooking.booking.serviceStartedAt).toLocaleString() : 'Not started yet'}
                                                    </p>
                                                </div>
                                            </li>
                                            <li className="flex items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedBooking.booking.serviceCompletedAt ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                                    <Award className={`w-5 h-5 ${selectedBooking.booking.serviceCompletedAt ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="ml-4">
                                                    <p className="font-medium">Service Completed</p>
                                                    <p className="text-sm text-gray-500">
                                                        {selectedBooking.booking.serviceCompletedAt ? new Date(selectedBooking.booking.serviceCompletedAt).toLocaleString() : 'Not completed yet'}
                                                    </p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>

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

            {/* Reschedule Booking Modal */}
            {showRescheduleModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-secondary">Reschedule Booking</h3>
                                <button
                                    onClick={() => setShowRescheduleModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New Date
                                    </label>
                                    <input
                                        type="date"
                                        id="rescheduleDate"
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New Time
                                    </label>
                                    <input
                                        type="time"
                                        id="rescheduleTime"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                
                                <div className="flex space-x-3 pt-4">
                                    <button
                                        onClick={() => setShowRescheduleModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const date = document.getElementById('rescheduleDate').value;
                                            const time = document.getElementById('rescheduleTime').value;
                                            if (date || time) {
                                                handleRescheduleBooking(selectedBooking._id, date, time);
                                            } else {
                                                showToast('Please provide either date or time', 'error');
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Updating...' : 'Update Schedule'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Provider Modal */}
            {showAssignProviderModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-secondary">Assign Provider</h3>
                                <button
                                    onClick={() => setShowAssignProviderModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Provider
                                    </label>
                                    <select
                                        id="providerSelect"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    >
                                        <option value="">Select a provider</option>
                                        {getFilteredProviders(selectedBooking).map(provider => (
                                            <option key={provider._id} value={provider._id}>
                                                {provider.businessName || provider.name} - {provider.serviceLocation?.city || provider.city || 'N/A'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Showing providers matching the service location
                                    </p>
                                </div>
                                
                                <div className="flex space-x-3 pt-4">
                                    <button
                                        onClick={() => setShowAssignProviderModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const providerId = document.getElementById('providerSelect').value;
                                            if (providerId) {
                                                handleAssignProvider(selectedBooking._id, providerId);
                                            } else {
                                                showToast('Please select a provider', 'error');
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Assigning...' : 'Assign Provider'}
                                    </button>
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
                            <h3 className="text-lg font-semibold text-secondary">
                                {deleteConfirm.type === 'user' ? 'Delete User Booking' : 'Delete Booking'}
                            </h3>
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
                                    if (deleteConfirm.type === 'user') {
                                        handleDeleteUserBooking(deleteConfirm.userId, deleteConfirm.id);
                                    } else {
                                        handleDeleteBooking(deleteConfirm.id);
                                    }
                                }}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {actionLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBookingsView;