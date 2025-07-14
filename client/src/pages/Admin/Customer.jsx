import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Search, Users, Calendar, Phone, Mail, MapPin, Eye, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

const AdminCustomersView = () => {
    const { token, API, showToast } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCustomer, setExpandedCustomer] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    // Fetch customers from API
    const fetchCustomers = async (page = 1, search = '') => {
        setLoading(true);
        try {
            const response = await fetch(
                `${API}/admin/customers?page=${page}&limit=${pagination.limit}&search=${search}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch customers');
            }

            const data = await response.json();
            
            if (data.success) {
                setCustomers(data.customers);
                setPagination(prev => ({
                    ...prev,
                    page: data.page,
                    total: data.total,
                    pages: data.pages
                }));
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

    // Initial load
    useEffect(() => {
        fetchCustomers();
    }, []);

    // Handle search
    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        
        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchCustomers(1, value);
        }, 500);

        return () => clearTimeout(timeoutId);
    };

    // Handle page change
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            fetchCustomers(newPage, searchTerm);
        }
    };

    // Toggle customer details
    const toggleCustomerDetails = (customerId) => {
        setExpandedCustomer(expandedCustomer === customerId ? null : customerId);
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Loading skeleton
    const LoadingSkeleton = () => (
        <div className="animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 mb-4">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-blue-100 rounded w-1/4"></div>
                            <div className="h-3 bg-blue-100 rounded w-1/3"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-blue-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-2">
                        Customer Management
                    </h1>
                    <p className="text-gray-600">
                        Manage and view all registered customers
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-blue-100">
                        <div className="flex items-center">
                            <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                            </div>
                            <div className="ml-3 md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-600">Total Customers</p>
                                <p className="text-xl md:text-2xl font-semibold text-blue-900">{pagination.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-green-100">
                        <div className="flex items-center">
                            <div className="p-2 md:p-3 bg-green-100 rounded-full">
                                <Calendar className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                            </div>
                            <div className="ml-3 md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-600">Active Today</p>
                                <p className="text-xl md:text-2xl font-semibold text-green-800">
                                    {customers.filter(c => {
                                        const today = new Date().toDateString();
                                        return new Date(c.updatedAt).toDateString() === today;
                                    }).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-purple-100">
                        <div className="flex items-center">
                            <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                                <Filter className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                            </div>
                            <div className="ml-3 md:ml-4">
                                <p className="text-xs md:text-sm font-medium text-gray-600">Showing Results</p>
                                <p className="text-xl md:text-2xl font-semibold text-purple-800">{customers.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-4 md:mb-6 border border-blue-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                        <input
                            type="text"
                            placeholder="Search customers by name, email, or phone..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="w-full pl-9 md:pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base"
                        />
                    </div>
                </div>

                {/* Customers List */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-blue-100">
                    <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 bg-blue-50">
                        <h2 className="text-base md:text-lg font-medium text-blue-900">
                            All Customers ({pagination.total})
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-4 md:p-6">
                            <LoadingSkeleton />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="p-8 md:p-12 text-center">
                            <Users className="h-10 w-10 md:h-12 md:w-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                            <p className="text-gray-500">No customers found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                            Contact
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider hidden md:table-cell">
                                            Location
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider hidden sm:table-cell">
                                            Stats
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {customers.map((customer) => (
                                        <React.Fragment key={customer._id}>
                                            <tr className="hover:bg-blue-50">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                            <span className="text-blue-600 font-medium">
                                                                {customer.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-blue-900">
                                                                {customer.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                ID: {customer._id.slice(-8)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        <div className="flex items-center mb-1">
                                                            <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                                            <span className="truncate max-w-[120px] md:max-w-none">{customer.email}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                                            {customer.phone || 'N/A'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                                                    <div className="text-sm text-gray-900">
                                                        {customer.address ? (
                                                            <div className="flex items-center">
                                                                <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                                                                <div>
                                                                    <div>{customer.address.city || 'N/A'}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {customer.address.state || 'N/A'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-500">No address</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                                                    <div className="text-sm text-gray-900">
                                                        <div className="mb-1">
                                                            <span className="font-medium">Bookings:</span> {customer.totalBookings || 0}
                                                        </div>
                                                        <div className="mb-1">
                                                            <span className="font-medium">Spent:</span> ₹{customer.totalSpent || 0}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <button
                                                        onClick={() => toggleCustomerDetails(customer._id)}
                                                        className="flex items-center text-blue-600 hover:text-blue-800"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        <span>{expandedCustomer === customer._id ? 'Hide' : 'View'}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedCustomer === customer._id && (
                                                <tr className="bg-blue-50">
                                                    <td colSpan="5" className="px-4 py-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            <div className="bg-white p-4 rounded-lg shadow-xs border border-blue-100">
                                                                <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                                                    <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                                                                    Address Details
                                                                </h3>
                                                                {customer.address ? (
                                                                    <div className="text-sm text-gray-700 space-y-1">
                                                                        <p><span className="font-medium">Street:</span> {customer.address.street || 'N/A'}</p>
                                                                        <p><span className="font-medium">City:</span> {customer.address.city || 'N/A'}</p>
                                                                        <p><span className="font-medium">State:</span> {customer.address.state || 'N/A'}</p>
                                                                        <p><span className="font-medium">Country:</span> {customer.address.country || 'N/A'}</p>
                                                                        <p><span className="font-medium">Postal Code:</span> {customer.address.postalCode || 'N/A'}</p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-500">No address information available</p>
                                                                )}
                                                            </div>
                                                            <div className="bg-white p-4 rounded-lg shadow-xs border border-blue-100">
                                                                <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                                                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                                                                    Account Information
                                                                </h3>
                                                                <div className="text-sm text-gray-700 space-y-1">
                                                                    <p><span className="font-medium">Joined:</span> {formatDate(customer.createdAt)}</p>
                                                                    <p><span className="font-medium">Last Active:</span> {formatDate(customer.updatedAt)}</p>
                                                                    <p><span className="font-medium">Status:</span> <span className="text-green-600">Active</span></p>
                                                                    <p><span className="font-medium">Discount:</span> {customer.customDiscount || 0}%</p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-lg shadow-xs border border-blue-100">
                                                                <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                                                    <Users className="h-4 w-4 mr-2 text-blue-600" />
                                                                    Customer Stats
                                                                </h3>
                                                                <div className="text-sm text-gray-700 space-y-1">
                                                                    <p><span className="font-medium">Total Bookings:</span> {customer.totalBookings || 0}</p>
                                                                    <p><span className="font-medium">Total Spent:</span> ₹{customer.totalSpent || 0}</p>
                                                                    <p><span className="font-medium">Average Booking:</span> ₹{customer.totalBookings ? Math.round(customer.totalSpent / customer.totalBookings) : 0}</p>
                                                                    <p><span className="font-medium">Loyalty Points:</span> {customer.loyaltyPoints || 0}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="bg-white px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-blue-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.pages}
                                    className="ml-3 relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-blue-50 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing{' '}
                                        <span className="font-medium text-blue-900">
                                            {(pagination.page - 1) * pagination.limit + 1}
                                        </span>{' '}
                                        to{' '}
                                        <span className="font-medium text-blue-900">
                                            {Math.min(pagination.page * pagination.limit, pagination.total)}
                                        </span>{' '}
                                        of{' '}
                                        <span className="font-medium text-blue-900">{pagination.total}</span>{' '}
                                        results
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                        <button
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={pagination.page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 disabled:opacity-50"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                        {[...Array(pagination.pages)].map((_, i) => {
                                            // Show limited page numbers with ellipsis
                                            if (pagination.pages <= 7 || 
                                                i === 0 || 
                                                i === pagination.pages - 1 || 
                                                Math.abs(pagination.page - (i + 1)) <= 2) {
                                                return (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => handlePageChange(i + 1)}
                                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                            pagination.page === i + 1
                                                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                                : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50'
                                                        }`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                );
                                            }
                                            if (Math.abs(pagination.page - (i + 1)) === 3) {
                                                return (
                                                    <span key={i + 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                                        ...
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })}
                                        <button
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={pagination.page === pagination.pages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 disabled:opacity-50"
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminCustomersView;