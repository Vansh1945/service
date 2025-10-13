import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Percent,
  DollarSign,
  Users,
  Globe,
  Gift,
  Calendar,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminCoupons = () => {
  const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token");

  // State management
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    global: 0,
    firstBooking: 0
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    code: '',
    discountType: 'flat',
    discountValue: '',
    expiryDate: '',
    minBookingValue: '',
    isGlobal: false,
    isFirstBooking: false,
    assignedTo: '',
    usageLimit: ''
  });
  const [editForm, setEditForm] = useState({});

  // Check admin access
  useEffect(() => {
    fetchCoupons();
    fetchUsers();
  }, []);

  // Filter and search coupons
  useEffect(() => {
    let filtered = [...coupons];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(coupon =>
        coupon.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'global') {
        filtered = filtered.filter(coupon => coupon.isGlobal);
      } else if (typeFilter === 'first-booking') {
        filtered = filtered.filter(coupon => coupon.isFirstBooking);
      } else if (typeFilter === 'assigned') {
        filtered = filtered.filter(coupon => coupon.assignedTo);
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(coupon => coupon.isActive === isActive);
    }

    setFilteredCoupons(filtered);
  }, [coupons, searchTerm, typeFilter, statusFilter]);

  // Calculate stats whenever coupons change
  useEffect(() => {
    const newStats = {
      total: coupons.length,
      active: coupons.filter(c => c.isActive && new Date(c.expiryDate) > new Date()).length,
      expired: coupons.filter(c => new Date(c.expiryDate) <= new Date()).length,
      global: coupons.filter(c => c.isGlobal).length,
      firstBooking: coupons.filter(c => c.isFirstBooking).length
    };
    setStats(newStats);
  }, [coupons]);

  // Fetch all coupons
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/coupon/admin/coupons`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch coupons: ${response.status}`);
      }

      const data = await response.json();
      setCoupons(data.data || data.coupons || []);
    } catch (error) {
      console.error('Fetch coupons error:', error);
      toast.error(error.message || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for assignment
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API}/admin/customers?limit=10000`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Users data:', data); // Debug log

        const usersList = data.users || [];
        setUsers(usersList);

        if (usersList.length === 0) {
          console.log('No users found in response');
        }
      } else {
        console.error('Failed to fetch users:', response.status);
        toast.error('Failed to load users list');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Error loading users');
    }
  };

  // Handle create form changes
  const handleCreateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle edit form changes
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Create new coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const couponData = {
        ...createForm,
        discountValue: Number(createForm.discountValue),
        minBookingValue: Number(createForm.minBookingValue) || 0,
        usageLimit: createForm.usageLimit ? Number(createForm.usageLimit) : null,
        assignedTo: createForm.assignedTo || null
      };

      const response = await fetch(`${API}/coupon/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(couponData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create coupon');
      }

      const data = await response.json();
      setCoupons(prev => [data.data, ...prev]);
      toast.success('Coupon created successfully!');
      resetCreateForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Create coupon error:', error);
      toast.error(error.message || 'Failed to create coupon');
    }
  };

  // Update coupon
  const handleUpdateCoupon = async (e) => {
    e.preventDefault();
    try {
      // Prepare update data - don't send fields that shouldn't be modified if coupon has been used
      const updateData = { ...editForm };

      // Convert numeric fields to numbers
      updateData.discountValue = Number(updateData.discountValue);
      updateData.minBookingValue = Number(updateData.minBookingValue) || 0;
      updateData.usageLimit = updateData.usageLimit ? Number(updateData.usageLimit) : null;

      if (selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0) {
        // Remove restricted fields if coupon has been used
        delete updateData.code;
        delete updateData.discountType;
        delete updateData.discountValue;
        delete updateData.isGlobal;
        delete updateData.isFirstBooking;
      }

      const response = await fetch(`${API}/coupon/admin/coupon/${selectedCoupon._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update coupon');
      }

      const data = await response.json();
      setCoupons(prev => prev.map(c => c._id === data.data._id ? data.data : c));
      toast.success('Coupon updated successfully!');
      setShowEditModal(false);
    } catch (error) {
      console.error('Update coupon error:', error);
      toast.error(error.message || 'Failed to update coupon');
    }
  };

  // Delete coupon (soft delete)
  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Are you sure you want to deactivate this coupon?')) return;

    try {
      const response = await fetch(`${API}/coupon/admin/coupons/${couponId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to deactivate coupon');
      }

      await fetchCoupons();
      toast.success('Coupon deactivated successfully!');
    } catch (error) {
      console.error('Delete coupon error:', error);
      toast.error(error.message || 'Failed to deactivate coupon');
    }
  };

  // Hard delete coupon
  const handleHardDeleteCoupon = async (couponId) => {
    if (!window.confirm('Are you sure you want to permanently delete this coupon? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API}/coupon/admin/coupons/${couponId}/hard`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete coupon');
      }

      await fetchCoupons();
      toast.success('Coupon deleted successfully!');
    } catch (error) {
      console.error('Hard delete coupon error:', error);
      toast.error(error.message || 'Failed to delete coupon');
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      code: '',
      discountType: 'flat',
      discountValue: '',
      expiryDate: '',
      minBookingValue: '',
      isGlobal: false,
      isFirstBooking: false,
      assignedTo: '',
      usageLimit: ''
    });
  };

  // Handle edit click
  const handleEditClick = (coupon) => {
    setSelectedCoupon(coupon);
    setEditForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().split('T')[0] : '',
      minBookingValue: coupon.minBookingValue || '',
      isGlobal: coupon.isGlobal,
      isFirstBooking: coupon.isFirstBooking,
      assignedTo: coupon.assignedTo ? (coupon.assignedTo._id || coupon.assignedTo) : '',
      usageLimit: coupon.usageLimit || '',
      isActive: coupon.isActive
    });
    setShowEditModal(true);
  };

  // Handle view click
  const handleViewClick = (coupon) => {
    setSelectedCoupon(coupon);
    setShowViewModal(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    const { city, state } = address;
    return [city, state].filter(Boolean).join(', ');
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Check if coupon is expired
  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  // Get remaining uses
  const getRemainingUses = (coupon) => {
    if (coupon.usageLimit === null) return 'Unlimited';
    return coupon.usageLimit - (coupon.usedBy?.length || 0);
  };

  // Get user display name
  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User';

    // Handle different user object structures
    if (typeof user === 'string') return user; 

    if (user.name) return user.name;
    if (user.email) return user.email;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCoupons = filteredCoupons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Coupons Management</h1>
            <p className="text-gray-600 mt-1">Manage discount coupons and promotions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
            Add Coupon
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Gift className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.active}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.expired}</p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Global Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.global}</p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <Globe className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">First Booking</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.firstBooking}</p>
              </div>
              <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
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
                  placeholder="Search coupons by code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Types</option>
                <option value="global">Global</option>
                <option value="first-booking">First Booking</option>
                <option value="assigned">Assigned</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading coupons...</p>
          </div>
        )}

        {/* Coupons Table */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {currentCoupons.length === 0 ? (
              <div className="text-center py-12 md:py-16">
                <Gift className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
                <p className="text-gray-600 text-md md:text-lg">No coupons found</p>
                <p className="text-gray-400 text-sm mt-1 md:mt-2">
                  {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first coupon to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Booking</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentCoupons.map((coupon) => (
                        <tr key={coupon._id} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm font-medium text-secondary font-mono">{coupon.code}</div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {coupon.discountType === 'flat' ? (
                                <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-green-600 mr-1" />
                              ) : (
                                <Percent className="w-3 h-3 md:w-4 md:h-4 text-blue-600 mr-1" />
                              )}
                              <span className="text-sm font-semibold">
                                {coupon.discountType === 'flat'
                                  ? formatCurrency(coupon.discountValue)
                                  : `${coupon.discountValue}%`
                                }
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {coupon.minBookingValue ? formatCurrency(coupon.minBookingValue) : 'None'}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mr-1" />
                              <span className={`text-sm ${isExpired(coupon.expiryDate) ? 'text-red-600' : 'text-gray-600'}`}>
                                {formatDate(coupon.expiryDate)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {coupon.isGlobal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Globe className="w-3 h-3 mr-1" />
                                Global
                              </span>
                            ) : coupon.isFirstBooking ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Users className="w-3 h-3 mr-1" />
                                First Booking
                              </span>
                            ) : coupon.assignedTo ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Users className="w-3 h-3 mr-1" />
                                Assigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Standard
                              </span>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {coupon.usedBy?.length || 0} / {coupon.usageLimit === null ? '∞' : coupon.usageLimit}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coupon.isActive && !isExpired(coupon.expiryDate)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}>
                              {coupon.isActive && !isExpired(coupon.expiryDate) ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  {isExpired(coupon.expiryDate) ? 'Expired' : 'Inactive'}
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="Edit Coupon"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(coupon._id)}
                                className="text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-200"
                                title="Deactivate Coupon"
                              >
                                <Trash2 className="w-4 h-4" />
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
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCoupons.length)} of {filteredCoupons.length} results
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

        {/* Create Coupon Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              resetCreateForm();
            }}
            title="Create New Coupon"
            size="large"
          >
            <form onSubmit={handleCreateCoupon} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={createForm.code}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="e.g., WELCOME20"
                    pattern="[A-Z0-9_]{5,20}"
                    title="5-20 uppercase alphanumeric characters or underscores"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Type *
                  </label>
                  <select
                    name="discountType"
                    value={createForm.discountType}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    value={createForm.discountValue}
                    onChange={handleCreateFormChange}
                    required
                    min="1"
                    step={createForm.discountType === 'percent' ? "1" : "any"}
                    max={createForm.discountType === 'percent' ? "100" : ""}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={createForm.discountType === 'flat' ? "e.g., 200" : "e.g., 20"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Minimum Booking Value (₹)
                  </label>
                  <input
                    type="number"
                    name="minBookingValue"
                    value={createForm.minBookingValue}
                    onChange={handleCreateFormChange}
                    min="0"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 1000 (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={createForm.expiryDate}
                    onChange={handleCreateFormChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    name="usageLimit"
                    value={createForm.usageLimit}
                    onChange={handleCreateFormChange}
                    min="1"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isGlobal"
                    id="isGlobal"
                    checked={createForm.isGlobal}
                    onChange={handleCreateFormChange}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="isGlobal" className="ml-2 block text-sm text-gray-900">
                    Global Coupon (Available to all users)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isFirstBooking"
                    id="isFirstBooking"
                    checked={createForm.isFirstBooking}
                    onChange={handleCreateFormChange}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="isFirstBooking" className="ml-2 block text-sm text-gray-900">
                    First Booking Only
                  </label>
                </div>
              </div>

              {!createForm.isGlobal && !createForm.isFirstBooking && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Assign to User (Optional)
                  </label>
                  {users.length > 0 ? (
                    <select
                      name="assignedTo"
                      value={createForm.assignedTo}
                      onChange={handleCreateFormChange}
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a user (optional)</option>
                      {users.map(user => {
                        const userObj = typeof user === 'string' ? { _id: user } : user;
                        return (
                          <option key={userObj._id} value={userObj._id}>
                            {getUserDisplayName(userObj)}
                            {userObj.email ? ` - ${userObj.email}` : ''}
                            {userObj.address ? ` - ${formatAddress(userObj.address)}` : ''}
                            {userObj.totalBookings !== undefined ? ` - ${userObj.totalBookings || 0} bookings` : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="assignedTo"
                      value={createForm.assignedTo}
                      onChange={handleCreateFormChange}
                      placeholder="Enter user ID manually"
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Coupon
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Coupon Modal */}
        {showEditModal && selectedCoupon && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="Edit Coupon"
            size="large"
          >
            <form onSubmit={handleUpdateCoupon} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={editForm.code}
                    onChange={handleEditFormChange}
                    required
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono disabled:bg-gray-100"
                    pattern="[A-Z0-9_]{5,20}"
                    title="5-20 uppercase alphanumeric characters or underscores"
                  />
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Code cannot be changed after usage</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Type *
                  </label>
                  <select
                    name="discountType"
                    value={editForm.discountType}
                    onChange={handleEditFormChange}
                    required
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Discount type cannot be changed after usage</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    value={editForm.discountValue}
                    onChange={handleEditFormChange}
                    required
                    min="1"
                    step={editForm.discountType === 'percent' ? "1" : "any"}
                    max={editForm.discountType === 'percent' ? "100" : ""}
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  />
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Discount value cannot be changed after usage</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Minimum Booking Value (₹)
                  </label>
                  <input
                    type="number"
                    name="minBookingValue"
                    value={editForm.minBookingValue}
                    onChange={handleEditFormChange}
                    min="0"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={editForm.expiryDate}
                    onChange={handleEditFormChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    name="usageLimit"
                    value={editForm.usageLimit}
                    onChange={handleEditFormChange}
                    min="1"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isGlobal"
                    id="editIsGlobal"
                    checked={editForm.isGlobal}
                    onChange={handleEditFormChange}
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:bg-gray-100"
                  />
                  <label htmlFor="editIsGlobal" className="ml-2 block text-sm text-gray-900">
                    Global Coupon (Available to all users)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isFirstBooking"
                    id="editIsFirstBooking"
                    checked={editForm.isFirstBooking}
                    onChange={handleEditFormChange}
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:bg-gray-100"
                  />
                  <label htmlFor="editIsFirstBooking" className="ml-2 block text-sm text-gray-900">
                    First Booking Only
                  </label>
                </div>
              </div>

              {!editForm.isGlobal && !editForm.isFirstBooking && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Assign to User (Optional)
                  </label>
                  <select
                    name="assignedTo"
                    value={editForm.assignedTo}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a user (optional)</option>
                    {users.map(user => {
                      const userObj = typeof user === 'string' ? { _id: user } : user;
                      return (
                        <option key={userObj._id} value={userObj._id}>
                          {getUserDisplayName(userObj)}
                          {userObj.email ? ` - ${userObj.email}` : ''}
                          {userObj.address ? ` - ${formatAddress(userObj.address)}` : ''}
                          {userObj.totalBookings !== undefined ? ` - ${userObj.totalBookings || 0} bookings` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={handleEditFormChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active Coupon
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Update Coupon
                </button>
                {selectedCoupon.usedBy && selectedCoupon.usedBy.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleHardDeleteCoupon(selectedCoupon._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </button>
                )}
              </div>
            </form>
          </Modal>
        )}

        {/* View Coupon Modal */}
        {showViewModal && selectedCoupon && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Coupon Details"
            size="large"
          >
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border border-teal-200">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-secondary font-mono">{selectedCoupon.code}</h3>
                    <div className="flex items-center mt-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate) ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-1" />
                            {isExpired(selectedCoupon.expiryDate) ? 'Expired' : 'Inactive'}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-teal-800">
                    {selectedCoupon.discountType === 'flat'
                      ? formatCurrency(selectedCoupon.discountValue)
                      : `${selectedCoupon.discountValue}% OFF`
                    }
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Expiry Date</span>
                  </div>
                  <p className={`text-lg font-semibold ${isExpired(selectedCoupon.expiryDate) ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatDate(selectedCoupon.expiryDate)}
                  </p>
                  {isExpired(selectedCoupon.expiryDate) && (
                    <p className="text-xs text-red-500 mt-1">This coupon has expired</p>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Users className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Usage</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedCoupon.usedBy?.length || 0} / {selectedCoupon.usageLimit === null ? 'Unlimited' : selectedCoupon.usageLimit}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Used / Total Limit</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <DollarSign className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Min. Booking</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedCoupon.minBookingValue ? formatCurrency(selectedCoupon.minBookingValue) : 'No minimum'}
                  </p>
                </div>
              </div>

              {/* Type Information */}
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-secondary mb-4">Coupon Type</h4>
                <div className="flex items-center">
                  {selectedCoupon.isGlobal ? (
                    <>
                      <Globe className="w-6 h-6 text-blue-600 mr-3" />
                      <div>
                        <p className="font-medium">Global Coupon</p>
                        <p className="text-sm text-gray-600">Available to all users</p>
                      </div>
                    </>
                  ) : selectedCoupon.isFirstBooking ? (
                    <>
                      <Users className="w-6 h-6 text-purple-600 mr-3" />
                      <div>
                        <p className="font-medium">First Booking Coupon</p>
                        <p className="text-sm text-gray-600">Only for users with no previous bookings</p>
                      </div>
                    </>
                  ) : selectedCoupon.assignedTo ? (
                    <>
                      <Users className="w-6 h-6 text-orange-600 mr-3" />
                      <div>
                        <p className="font-medium">Assigned to User</p>
                        <p className="text-sm text-gray-600">
                          {getUserDisplayName(selectedCoupon.assignedTo)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Gift className="w-6 h-6 text-gray-600 mr-3" />
                      <div>
                        <p className="font-medium">Standard Coupon</p>
                        <p className="text-sm text-gray-600">Available to all users (non-global)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Usage History */}
              {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-secondary mb-4">Usage History</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Value</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCoupon.usedBy.map((usage, index) => (
                          <tr key={index}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {getUserDisplayName(usage.user)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {usage.user?.email || ''}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatCurrency(usage.bookingValue)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(usage.usedAt)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditClick(selectedCoupon);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Coupon
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

// Reusable Modal Component
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
                    <X className="w-5 h-5" />
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

export default AdminCoupons;
