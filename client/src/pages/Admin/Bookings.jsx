import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import Loader from '../../components/Loader';
import * as BookingService from '../../services/BookingService';
import * as AdminService from '../../services/AdminService';
import Pagination from '../../components/Pagination';
import { formatDate, formatCurrency } from '../../utils/format';
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
    ChevronRight,
    ExternalLink
} from 'lucide-react';

// Static option arrays outside component — never change between renders
const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
];

const paymentStatusOptions = [
    { value: '', label: 'All Payment Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' }
];

const timeRangeOptions = [
    { value: '', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half-year', label: 'Half Year' },
    { value: 'year', label: 'Yearly' }
];

// Helper functions outside component to prevent recreation on every render
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


// Memoized Booking Row to prevent unnecessary re-renders
const BookingRow = React.memo(({ booking, onDetails, onReschedule, onAssign, onDelete }) => (
    <tr className="hover:bg-gray-50">
        <td className="px-4 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-secondary">
                {booking.bookingId || `#${booking._id?.substring(booking._id.length - 8) || 'N/A'}`}
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
                    {booking.provider?.providerId && (
                        <span className="ml-1 text-[10px] text-gray-400 font-mono">[{booking.provider.providerId}]</span>
                    )}
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
                    onClick={() => onDetails(booking._id)}
                    className="p-1 text-primary hover:text-teal-700"
                    title="View Details"
                >
                    <Eye className="w-4 h-4" />
                </button>

                <button
                    onClick={() => onReschedule(booking)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Update Date/Time"
                >
                    <Calendar className="w-4 h-4" />
                </button>

                {booking.status === 'pending' && !booking.provider && (
                    <button
                        onClick={() => onAssign(booking)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Assign Provider"
                    >
                        <UserCheck className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={() => onDelete(booking)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete Booking"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </td>
    </tr>
));

const AdminBookingsView = () => {
    const { token, API, showToast } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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

    // Filter states - initialize from URL to prevent race conditions and flashes
    const [filters, setFilters] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            status: '',
            startDate: '',
            endDate: '',
            search: params.get('search') || '',
            paymentStatus: '',
            timeRange: ''
        };
    });

    // Pagination state
    const [pagination, setPagination] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            page: parseInt(params.get('page')) || 1,
            limit: 10,
            total: 0,
            pages: 0
        };
    });

    // Update filters when URL search param changes (for in-page navigation)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const searchParam = params.get('search');
        
        // Only update if the search filter actually changed to avoid infinite loops
        if (searchParam !== undefined && searchParam !== filters.search) {
            setFilters(prev => ({ ...prev, search: searchParam || '' }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, [location.search]);

    // Fetch all providers for assignment — useCallback keeps reference stable
    const fetchProviders = useCallback(async () => {
        try {
            const response = await AdminService.getAllProviders();
            const data = response.data;
            setProviders(data.providers || data.data || []);
        } catch (error) {
            console.error('Error fetching providers:', error);
            showToast(error.message, 'error');
        }
    }, [showToast]);

    // Fetch bookings with filters and pagination
    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);

            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
            };

            const response = await BookingService.getAllBookings(params);
            const data = response.data;

            if (data.success || response.status === 200) {
                const fetchedBookings = data.data || [];

                setBookings(fetchedBookings);
                setPagination(prev => ({
                    ...prev,
                    total: data.total || 0,
                    pages: data.pages || 1
                }));

                // Set global stats from backend instead of local calculation
                if (data.stats) {
                    setStats(data.stats);
                }
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast, filters, pagination.page, pagination.limit]);



    // Fetch booking details
    const fetchBookingDetails = useCallback(async (bookingId) => {
        try {
            setActionLoading(true);
            const response = await BookingService.getBookingDetails(bookingId);
            const data = response.data;
            setSelectedBooking(data.data);
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching booking details:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast]);

    // Delete booking
    const handleDeleteBooking = useCallback(async (bookingId) => {
        try {
            setActionLoading(true);
            await BookingService.deleteBooking(bookingId);
            showToast('Booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Delete user booking
    const handleDeleteUserBooking = useCallback(async (userId, bookingId) => {
        try {
            setActionLoading(true);
            await BookingService.deleteUserBooking(userId, bookingId);
            showToast('User booking deleted successfully', 'success');
            setDeleteConfirm(null);
            fetchBookings();
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting user booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Assign provider to booking
    const handleAssignProvider = useCallback(async (bookingId, providerId) => {
        try {
            setActionLoading(true);
            await BookingService.assignProvider(bookingId, { providerId });
            showToast('Provider assigned successfully', 'success');
            fetchBookings();
            setShowAssignProviderModal(false);
            if (selectedBooking) {
                fetchBookingDetails(selectedBooking._id);
            }
        } catch (error) {
            console.error('Error assigning provider:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings, fetchBookingDetails, selectedBooking]);

    // Reschedule booking
    const handleRescheduleBooking = useCallback(async (bookingId, newDate, newTime) => {
        try {
            setActionLoading(true);
            const body = {};
            if (newDate) body.date = newDate;
            if (newTime) body.time = newTime;

            await BookingService.updateBookingDateTimeAdmin(bookingId, body);
            showToast('Booking rescheduled successfully', 'success');
            fetchBookings();
            setShowRescheduleModal(false);
            setShowModal(false);
        } catch (error) {
            console.error('Error rescheduling booking:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, fetchBookings]);

    // Download booking report
    const handleDownloadReport = useCallback(async () => {
        if (!filters.startDate || !filters.endDate) {
            showToast('Please select a date range to export the report.', 'error');
            return;
        }
        try {
            setActionLoading(true);
            const params = {
                startDate: filters.startDate,
                endDate: filters.endDate
            };

            const response = await BookingService.downloadBookingReport(params, { responseType: 'blob' });
            
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `booking_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showToast('Report downloaded successfully', 'success');
        } catch (error) {
            console.error('Error downloading report:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showToast, filters.startDate, filters.endDate]);

    // Handle filter changes — useCallback avoids recreation on every render
    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const navigateToTransaction = (bookingId) => {
        if (!bookingId) {
            showToast('No booking ID available', 'error');
            return;
        }
        navigate(`/admin/transactions?bookingId=${bookingId}`);
    };

    // Clear all filters
    const clearFilters = useCallback(() => {
        setFilters({
            status: '',
            startDate: '',
            endDate: '',
            search: '',
            paymentStatus: '',
            timeRange: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // Pagination handlers
    const goToPage = useCallback((page) => {
        setPagination(prev => ({ ...prev, page }));
    }, []);

    const nextPage = useCallback(() => {
        setPagination(prev =>
            prev.page < prev.pages ? { ...prev, page: prev.page + 1 } : prev
        );
    }, []);

    const prevPage = useCallback(() => {
        setPagination(prev =>
            prev.page > 1 ? { ...prev, page: prev.page - 1 } : prev
        );
    }, []);


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

    // Render table content based on loading and data state
    const renderTableContent = () => {
        if (loading) {
            return (
                <tr>
                    <td colSpan="7" className="px-4 py-8">
                        <Loader />
                    </td>
                </tr>
            );
        }

        if (bookings.length === 0) {
            return (
                <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No bookings found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                    </td>
                </tr>
            );
        }

        return bookings.map((booking) => (
            <BookingRow
                key={booking._id}
                booking={booking}
                onDetails={fetchBookingDetails}
                onReschedule={(b) => { setSelectedBooking(b); setShowRescheduleModal(true); }}
                onAssign={(b) => { setSelectedBooking(b); setShowAssignProviderModal(true); }}
                onDelete={(b) => setDeleteConfirm({
                    id: b._id,
                    userId: b.customer?._id,
                    type: 'booking'
                })}
            />
        ));
    };

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
                    className={`px-3 py-1 rounded-lg ${pagination.page === i
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

                    {/* Time Range Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
                        <select
                            value={filters.timeRange}
                            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {timeRangeOptions.map(option => (
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
                <div className="flex flex-wrap items-center gap-2 mt-4">
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
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 text-sm font-semibold rounded-full border border-blue-100">
                                Filtered by Booking ID: {filters.search}
                                <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('search', '')} />
                            </span>
                            <button 
                                onClick={() => handleFilterChange('search', '')}
                                className="text-xs text-red-500 hover:underline font-medium"
                            >
                                Clear Filter
                            </button>
                        </div>
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
                            {renderTableContent()}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.pages}
                    totalItems={pagination.total}
                    limit={pagination.limit}
                    onPageChange={(page) => goToPage(page)}
                />
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
                                                <p className="font-medium text-primary">{selectedBooking.booking.bookingId || selectedBooking.booking._id}</p>
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
                                            <h3 className="font-semibold text-secondary mb-3 flex items-center">
                                                <User className="w-4 h-4 mr-2" />
                                                Provider Information
                                            </h3>
                                            <div className="space-y-3">
                                                {/* Provider Header */}
                                                <div className="flex items-center space-x-3 pb-3 border-b border-gray-200">
                                                    <div className="w-12 h-12 bg-gradient-to-r from-primary to-teal-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {selectedBooking.provider.profilePicUrl && selectedBooking.provider.profilePicUrl !== 'default-provider.jpg' ? (
                                                            <img
                                                                src={selectedBooking.provider.profilePicUrl}
                                                                alt="Provider"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <User className="w-6 h-6 text-white" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-secondary">
                                                            {selectedBooking.provider.businessName || selectedBooking.provider.name || 'N/A'}
                                                            {selectedBooking.provider.providerId && (
                                                                <span className="ml-2 text-xs text-gray-500 font-mono">[{selectedBooking.provider.providerId}]</span>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-gray-600 flex items-center">
                                                            <Mail className="w-3 h-3 mr-1" />
                                                            {selectedBooking.provider.email || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Provider Details */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-sm text-gray-600">Phone:</span>
                                                        <p className="font-medium flex items-center">
                                                            <Phone className="w-3 h-3 mr-1" />
                                                            {selectedBooking.provider.phone || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-600">Experience:</span>
                                                        <p className="font-medium">{selectedBooking.provider.experience || '0'} years</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-600">Service Area:</span>
                                                        <p className="font-medium">{selectedBooking.provider.serviceArea || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm text-gray-600">Rating:</span>
                                                        <p className="font-medium flex items-center">
                                                            <Star className="w-3 h-3 mr-1 text-yellow-500" />
                                                            {selectedBooking.provider.rating || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Services Offered */}
                                                {selectedBooking.provider.services && selectedBooking.provider.services.length > 0 && (
                                                    <div>
                                                        <span className="text-sm text-gray-600">Services Offered:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {selectedBooking.provider.services.slice(0, 3).map((service, index) => (
                                                                <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                                                                    {service.name || service}
                                                                </span>
                                                            ))}
                                                            {selectedBooking.provider.services.length > 3 && (
                                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                                    +{selectedBooking.provider.services.length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Bank Verification Status */}
                                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                                    <span className="text-sm text-gray-600">Bank Verified:</span>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedBooking.provider.bankDetails?.verified
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {selectedBooking.provider.bankDetails?.verified ? 'Verified' : 'Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                            {selectedBooking.booking?.visitingCharge > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-600">Visiting Charge</span>
                                                    <span className="text-sm font-medium text-orange-600">+ {formatCurrency(selectedBooking.booking.visitingCharge)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-200 my-2"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-secondary">Total Amount Paid</span>
                                                <span className="font-bold text-primary text-lg">{formatCurrency(selectedBooking.payment.totalAmount)}</span>
                                            </div>

                                            {/* Commission Breakdown for Admin */}
                                            <div className="mt-3 pt-3 border-t border-dashed border-gray-200 bg-white/50 p-2 rounded-lg">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500 font-medium">Platform Commission:</span>
                                                    <span className="font-bold text-red-500">-{formatCurrency(selectedBooking.commission?.amount || selectedBooking.booking?.commissionAmount || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm mt-1">
                                                    <span className="text-gray-600 font-bold">Provider Net Earning:</span>
                                                    <span className="font-black text-green-600">
                                                        {formatCurrency(selectedBooking.booking?.providerEarnings || (selectedBooking.payment.totalAmount - (selectedBooking.commission?.amount || 0)))}
                                                    </span>
                                                </div>
                                                {selectedBooking.commission?.rule && (
                                                    <div className="text-[10px] text-gray-400 mt-1 text-right italic">
                                                        Applied Rule: {selectedBooking.commission.rule.name || 'Platform Standard'}
                                                    </div>
                                                )}
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
                                                {selectedBooking.payment.details?.transactionId ? (
                                                    <div className="flex justify-between items-center group">
                                                        <span className="text-sm text-gray-600">Transaction ID:</span>
                                                        <button 
                                                            onClick={() => navigateToTransaction(selectedBooking.booking.bookingId || selectedBooking.booking._id)}
                                                            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            {selectedBooking.payment.details.transactionId}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    selectedBooking.booking.paymentStatus === 'paid' && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-gray-600">Transaction:</span>
                                                            <button 
                                                                onClick={() => navigateToTransaction(selectedBooking.booking.bookingId || selectedBooking.booking._id)}
                                                                className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                View Transaction <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Service Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Service Information</h3>
                                        {selectedBooking.services?.map((serviceItem, index) => (
                                            <div key={index} className="mb-3 last:mb-0">
                                                <div className="font-medium">{serviceItem.service?.title || 'N/A'}</div>
                                                <div className="text-sm text-gray-600">
                                                    Category: {serviceItem.service?.category?.name || 'N/A'}
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
                                                {provider.providerId ? `[${provider.providerId}] ` : ''} {provider.businessName || provider.name} - {provider.serviceLocation?.city || provider.city || 'N/A'}
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