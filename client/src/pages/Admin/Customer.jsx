import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import { AdminLocalFilterBar } from '../../components/AdminFilterBar';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import { formatDate } from '../../utils/format';
import {
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
    Star,
    Wallet,
} from 'lucide-react';
import StatsCard from '../../components/ui/StatsCard';

const AdminCustomersDashboard = () => {
    const { token, API, showToast } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const urlSearch = searchParams.get('search') || '';
    const [searchTerm, setSearchTerm] = useState(urlSearch);

    useEffect(() => {
        setSearchTerm(urlSearch);
    }, [urlSearch]);

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
            const response = await AdminService.getAllCustomers();
            const data = response.data;

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

    const clearFilters = () => {
        setStatusFilter('all');
        setBookingFilter('all');
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
                    <StatsCard
                        title="Total Customers"
                        value={stats.total}
                        icon={Users}
                        iconBg="bg-teal-100"
                        iconColor="text-primary"
                    />
                    <StatsCard
                        title="Active"
                        value={stats.active}
                        icon={UserCheck}
                        iconBg="bg-green-100"
                        iconColor="text-green-600"
                    />
                    <StatsCard
                        title="Inactive"
                        value={stats.inactive}
                        icon={UserX}
                        iconBg="bg-red-100"
                        iconColor="text-red-600"
                    />
                    <StatsCard
                        title="New (7 days)"
                        value={stats.new}
                        icon={UserPlus}
                        iconBg="bg-blue-100"
                        iconColor="text-blue-600"
                    />
                    <StatsCard
                        title="With Bookings"
                        value={stats.withBookings}
                        icon={BookOpen}
                        iconBg="bg-orange-100"
                        iconColor="text-orange-600"
                    />
                    <StatsCard
                        title="With Discount"
                        value={stats.withDiscount}
                        icon={Award}
                        iconBg="bg-purple-100"
                        iconColor="text-purple-600"
                    />
                </div>

                {/* Filters and Search */}
                <AdminLocalFilterBar
                    filters={{ status: statusFilter, bookings: bookingFilter }}
                    onChange={(key, value) => {
                        if (key === 'status') setStatusFilter(value);
                        if (key === 'bookings') setBookingFilter(value);
                    }}
                    onClear={clearFilters}
                    fields={[
                        {
                            key: 'status',
                            label: 'Status',
                            type: 'select',
                            options: [
                                { value: 'all', label: 'All Status' },
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'new', label: 'New (7 days)' }
                            ]
                        },
                        {
                            key: 'bookings',
                            label: 'Bookings',
                            type: 'select',
                            options: [
                                { value: 'all', label: 'All Bookings' },
                                { value: 'withBookings', label: 'With Bookings' },
                                { value: 'withoutBookings', label: 'Without Bookings' },
                                { value: 'firstBookingPending', label: 'First Booking Pending' },
                                { value: 'firstBookingUsed', label: 'First Booking Used' }
                            ]
                        }
                    ]}
                />

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
                        <div className=" rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
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
                                                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
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
                                                    <td className="px-4 md:px-6 py-4 font-bold text-teal-600">
                                                        ₹{(customer.wallet?.availableBalance || 0).toLocaleString()}
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
                                <div className="mt-4 border-t border-gray-200">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        totalItems={filteredCustomers.length}
                                        limit={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
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

                                <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <Wallet className="w-5 h-5 text-teal-600 mr-2" />
                                        <span className="text-sm font-medium text-teal-700">Wallet Balance</span>
                                    </div>
                                    <p className="text-lg font-bold text-teal-600">
                                        ₹{(selectedCustomer.wallet?.availableBalance || 0).toLocaleString()}
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

                                {/* S2 Geofence Telemetry */}
                                {(selectedCustomer.address?.s2CellId || selectedCustomer.address?.s2CellIdPrecise) && (
                                    <div className="mt-4 bg-slate-900 p-3 rounded-lg border border-slate-700">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <MapPin className="w-3 h-3 text-teal-400" /> S2 Geofence Telemetry
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {selectedCustomer.address?.s2CellId && (
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800">
                                                    <span className="text-[10px] text-slate-400 font-medium mr-2">Level 13 (≈1km²)</span>
                                                    <span className="font-mono text-[10px] text-teal-300">
                                                        {selectedCustomer.address.s2CellId}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedCustomer.address?.s2CellIdPrecise && (
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800">
                                                    <span className="text-[10px] text-slate-400 font-medium mr-2">Level 15 (≈150m²)</span>
                                                    <span className="font-mono text-[10px] text-emerald-300">
                                                        {selectedCustomer.address.s2CellIdPrecise}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedCustomer.address?.lat && selectedCustomer.address?.lng && (
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800">
                                                    <span className="text-[10px] text-slate-400 font-medium mr-2">Coordinates</span>
                                                    <span className="font-mono text-[10px] text-slate-300">
                                                        {parseFloat(selectedCustomer.address.lat).toFixed(6)}, {parseFloat(selectedCustomer.address.lng).toFixed(6)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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

                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end items-center pt-4 border-t border-gray-200">
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
