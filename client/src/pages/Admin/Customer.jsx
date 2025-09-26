import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
    Search,
    Users,
    UserCheck,
    UserX,
    UserPlus,
    BookOpen,
    Filter,
    ChevronLeft,
    ChevronRight,
    Eye,
    Mail,
    Phone,
    MapPin,
    Calendar,
    FileText,
    Home,
    User,
    Award,
    TrendingUp,
    Sparkles,
    CheckCircle,
    XCircle,
    Clock,
    Star
} from 'lucide-react';

const AdminCustomersDashboard = () => {
    const { token, API, showToast } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [bookingFilter, setBookingFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    
    // Stats state
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        new: 0,
        withBookings: 0,
        withDiscount: 0
    });

    // Fetch customers
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API}/admin/customers`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch customers');

            const data = await response.json();

            if (data.success) {
                const customersData = data.users || data.customers || [];
                setCustomers(customersData);
                setFilteredCustomers(customersData);
                calculateStats(customersData);
            } else {
                showToast(data.message || 'Failed to fetch customers', 'error');
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('Error fetching customers', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats
    const calculateStats = (customersData) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const total = customersData.length;
        const active = customersData.filter(c => new Date(c.updatedAt) > thirtyDaysAgo).length;
        const inactive = customersData.filter(c => new Date(c.updatedAt) <= thirtyDaysAgo).length;
        const newCustomers = customersData.filter(c => new Date(c.createdAt) > sevenDaysAgo).length;
        const withBookings = customersData.filter(c => (c.totalBookings || 0) > 0).length;
        const withDiscount = customersData.filter(c => (c.customDiscount || 0) > 0).length;

        setStats({
            total,
            active,
            inactive,
            new: newCustomers,
            withBookings,
            withDiscount
        });
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Filter and search customers
    useEffect(() => {
        let filtered = [...customers];

        // Apply status filter
        if (statusFilter === 'active') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filtered = filtered.filter(c => new Date(c.updatedAt) > thirtyDaysAgo);
        } else if (statusFilter === 'inactive') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filtered = filtered.filter(c => new Date(c.updatedAt) <= thirtyDaysAgo);
        } else if (statusFilter === 'new') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filtered = filtered.filter(c => new Date(c.createdAt) > sevenDaysAgo);
        }

        // Apply booking filter
        if (bookingFilter === 'withBookings') {
            filtered = filtered.filter(c => (c.totalBookings || 0) > 0);
        } else if (bookingFilter === 'withoutBookings') {
            filtered = filtered.filter(c => (c.totalBookings || 0) === 0);
        } else if (bookingFilter === 'firstBookingPending') {
            filtered = filtered.filter(c => !c.firstBookingUsed);
        } else if (bookingFilter === 'firstBookingUsed') {
            filtered = filtered.filter(c => c.firstBookingUsed);
        }

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(customer =>
                customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                customer.phone?.includes(searchTerm) ||
                customer.address?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                customer.address?.state?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredCustomers(filtered);
        setCurrentPage(1);
    }, [customers, searchTerm, statusFilter, bookingFilter]);

    // Handle view click
    const handleViewClick = (customer) => {
        setSelectedCustomer(customer);
        setShowViewModal(true);
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Format address
    const formatAddress = (address) => {
        if (!address) return 'N/A';
        const { street, city, state, postalCode, country } = address;
        return [street, city, state, postalCode, country].filter(Boolean).join(', ');
    };

    // Get status badge
    const getStatusBadge = (customer) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isActive = new Date(customer.updatedAt) > thirtyDaysAgo;

        if (isActive) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactive
                </span>
            );
        }
    };

    // Get first booking badge
    const getFirstBookingBadge = (firstBookingUsed) => {
        if (firstBookingUsed) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Used
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                </span>
            );
        }
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

    return (
        <div className="min-h-screen p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-secondary">Customers Management</h1>
                        <p className="text-gray-600 mt-1">Manage and monitor all customer accounts</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 mb-6 md:mb-8">
                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Active</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.active}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-green-100 rounded-full">
                                <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-red-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Inactive</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.inactive}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-red-100 rounded-full">
                                <UserX className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">New (7 days)</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.new}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                                <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-orange-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">With Bookings</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.withBookings}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-orange-100 rounded-full">
                                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-purple-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">With Discount</p>
                                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.withDiscount}</p>
                            </div>
                            <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                                <Award className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
                    <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                                <input
                                    type="text"
                                    placeholder="Search customers by name, email, phone, city, state..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="new">New (7 days)</option>
                            </select>
                            <select
                                value={bookingFilter}
                                onChange={(e) => setBookingFilter(e.target.value)}
                                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            >
                                <option value="all">All Bookings</option>
                                <option value="withBookings">With Bookings</option>
                                <option value="withoutBookings">Without Bookings</option>
                                <option value="firstBookingPending">First Booking Pending</option>
                                <option value="firstBookingUsed">First Booking Used</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading customers...</p>
                    </div>
                )}

                {/* Customers Table */}
                {!loading && (
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        {currentCustomers.length === 0 ? (
                            <div className="text-center py-12 md:py-16">
                                <Users className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
                                <p className="text-gray-600 text-md md:text-lg">No customers found</p>
                                <p className="text-gray-400 text-sm mt-1 md:mt-2">
                                    {searchTerm || statusFilter !== 'all' || bookingFilter !== 'all'
                                        ? 'Try adjusting your search or filters'
                                        : 'No customers found'
                                    }
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Booking</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {currentCustomers.map((customer) => (
                                                <tr key={customer._id} className="hover:bg-gray-50 transition-colors duration-200">
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-10 w-10">
                                                                <img
                                                                    className="h-10 w-10 rounded-full object-cover"
                                                                    src={customer.profilePicUrl || '/default-avatar.png'}
                                                                    alt={customer.name}
                                                                    onError={(e) => {
                                                                        e.target.src = '/default-avatar.png';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-secondary">{customer.name}</div>
                                                                <div className="text-sm text-gray-500">
                                                                    {formatDate(customer.createdAt)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="text-sm text-gray-900">{customer.email}</div>
                                                        <div className="text-sm text-gray-500">{customer.phone || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="text-sm text-gray-900">{customer.address?.city || 'N/A'}</div>
                                                        <div className="text-sm text-gray-500">{customer.address?.state || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {customer.totalBookings || 0}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        {getFirstBookingBadge(customer.firstBookingUsed)}
                                                    </td>
                                                   
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="text-sm text-gray-900">
                                                            {formatDate(customer.createdAt)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        {getStatusBadge(customer)}
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleViewClick(customer)}
                                                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between bg-gray-50 gap-3">
                                        <div className="text-sm text-gray-600">
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCustomers.length)} of {filteredCustomers.length} results
                                        </div>
                                        <div className="flex items-center space-x-1 md:space-x-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                                const page = i + 1;
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`px-2 py-1 md:px-3 md:py-2 text-sm rounded-lg ${currentPage === page
                                                            ? 'bg-primary text-white'
                                                            : 'text-gray-600 hover:text-primary hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* View Customer Modal */}
                {showViewModal && selectedCustomer && (
                    <Modal
                        isOpen={showViewModal}
                        onClose={() => setShowViewModal(false)}
                        title="Customer Details"
                        size="large"
                    >
                        <div className="space-y-6">
                            {/* Header Section */}
                            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border border-teal-200">
                                <div className="flex flex-col md:flex-row items-start gap-6">
                                    <div className="flex-shrink-0">
                                        <img
                                            className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
                                            src={selectedCustomer.profilePicUrl || '/default-avatar.png'}
                                            alt={selectedCustomer.name}
                                            onError={(e) => {
                                                e.target.src = '/default-avatar.png';
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <h3 className="text-2xl md:text-3xl font-bold text-secondary">{selectedCustomer.name}</h3>
                                                <div className="flex items-center mt-2 gap-2">
                                                    {getStatusBadge(selectedCustomer)}
                                                    {!selectedCustomer.firstBookingUsed && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                            <Sparkles className="w-3 h-3 mr-1" />
                                                            New Customer
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-600">Member since</p>
                                                <p className="font-medium text-gray-900">{formatDate(selectedCustomer.createdAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <BookOpen className="w-5 h-5 text-gray-600 mr-2" />
                                        <span className="text-sm font-medium text-gray-700">Total Bookings</span>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {selectedCustomer.totalBookings || 0}
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <Award className="w-5 h-5 text-gray-600 mr-2" />
                                        <span className="text-sm font-medium text-gray-700">Custom Discount</span>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {selectedCustomer.customDiscount || 0}%
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                                        <span className="text-sm font-medium text-gray-700">Days as Member</span>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {Math.floor((new Date() - new Date(selectedCustomer.createdAt)) / (1000 * 60 * 60 * 24))} days
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <TrendingUp className="w-5 h-5 text-gray-600 mr-2" />
                                        <span className="text-sm font-medium text-gray-700">Account Status</span>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900 capitalize">
                                        {selectedCustomer.isActive !== false ? 'Active' : 'Inactive'}
                                    </p>
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200">
                                <h4 className="text-lg font-semibold text-secondary mb-4">Contact Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center">
                                        <Mail className="w-5 h-5 text-gray-600 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Email</p>
                                            <p className="text-sm text-gray-900">{selectedCustomer.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Phone className="w-5 h-5 text-gray-600 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Phone</p>
                                            <p className="text-sm text-gray-900">{selectedCustomer.phone || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <MapPin className="w-5 h-5 text-gray-600 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Address</p>
                                            <p className="text-sm text-gray-900">{formatAddress(selectedCustomer.address)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <User className="w-5 h-5 text-gray-600 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Role</p>
                                            <p className="text-sm text-gray-900 capitalize">{selectedCustomer.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Information */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200">
                                <h4 className="text-lg font-semibold text-secondary mb-4">Account Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">First Booking Status</p>
                                        {getFirstBookingBadge(selectedCustomer.firstBookingUsed)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Last Active</p>
                                        <p className="text-sm text-gray-900">{formatDate(selectedCustomer.updatedAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Registration Date</p>
                                        <p className="text-sm text-gray-900">{formatDate(selectedCustomer.createdAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Account Verified</p>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            selectedCustomer.isVerified 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {selectedCustomer.isVerified ? 'Verified' : 'Pending Verification'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                <button
                                    onClick={() => setShowViewModal(false)}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

// Reusable Modal Component (same as in AdminProviders)
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        medium: 'sm:max-w-lg',
        large: 'sm:max-w-2xl',
        xlarge: 'sm:max-w-4xl'
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} sm:w-full`}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-secondary">{title}</h3>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminCustomersDashboard;