import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiEdit, FiTrash2, FiX, FiPlus, FiSearch } from 'react-icons/fi';
import { FaPercentage, FaRupeeSign } from 'react-icons/fa';

const AdminCoupons = () => {
  const { API, isAdmin, logoutUser } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [users, setUsers] = useState([]); // Store users for name lookup
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'flat',
    discountValue: '',
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    minBookingValue: '',
    isGlobal: false,
    isFirstBooking: false,
    assignedTo: '',
    usageLimit: '',
    isActive: true
  });

  // Fetch all users for name lookup
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API}/admin/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Fetch coupons from backend
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/coupon/all-coupons`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch coupons');
      }
      
      const data = await response.json();
      setCoupons(data.data || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchCoupons();
      fetchUsers();
    }
  }, [isAdmin]);

  // Get user name by ID
  const getUserName = (userId) => {
    if (!userId) return null;
    const user = users.find(u => u._id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Prevent setting both isGlobal and isFirstBooking to true
    if (name === 'isGlobal' && checked) {
      setFormData(prev => ({
        ...prev,
        isGlobal: true,
        isFirstBooking: false,
        assignedTo: '' // Clear assignedTo when making global
      }));
    } else if (name === 'isFirstBooking' && checked) {
      setFormData(prev => ({
        ...prev,
        isFirstBooking: true,
        isGlobal: false,
        assignedTo: '' // Clear assignedTo when making first-booking
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Handle date change
  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      expiryDate: date
    }));
  };

  // Handle create coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      // Validate form data
      if (formData.discountType === 'percent' && formData.discountValue > 100) {
        throw new Error('Percentage discount cannot exceed 100%');
      }

      const response = await fetch(`${API}/coupon/add-coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          expiryDate: formData.expiryDate.toISOString(),
          assignedTo: formData.assignedTo || null // Send null if empty
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create coupon');
      }

      const data = await response.json();
      setCoupons([data.data, ...coupons]);
      setShowCreateModal(false);
      toast.success('Coupon created successfully!');
      resetForm();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Handle edit coupon
  const handleEditCoupon = async (e) => {
    e.preventDefault();
    try {
      // Prepare the data to send
      const updateData = {
        ...formData,
        expiryDate: formData.expiryDate.toISOString(),
        assignedTo: formData.assignedTo || null // Send null if empty
      };

      // Remove fields that shouldn't be updated if coupon has been used
      if (currentCoupon.usedBy.length > 0) {
        delete updateData.code;
        delete updateData.discountType;
        delete updateData.discountValue;
        delete updateData.isGlobal;
        delete updateData.isFirstBooking;
      }

      const response = await fetch(`${API}/coupon/update-coupons/${currentCoupon._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Handle specific error messages from backend
        if (errorData.error && errorData.error.includes('duplicate key')) {
          throw new Error('Coupon code already exists');
        }
        throw new Error(errorData.message || 'Failed to update coupon');
      }

      const data = await response.json();
      setCoupons(coupons.map(c => c._id === data.data._id ? data.data : c));
      setShowEditModal(false);
      toast.success('Coupon updated successfully!');
      resetForm();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(`Update failed: ${err.message}`);
    }
  };

  // Handle delete coupon (soft delete)
  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this coupon?')) return;
    
    try {
      const response = await fetch(`${API}/coupon/delete-coupons/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete coupon');
      }

      setCoupons(coupons.map(c => c._id === id ? { ...c, isActive: false } : c));
      toast.success('Coupon deactivated successfully!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Handle hard delete coupon
  const handleHardDeleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this coupon? This cannot be undone!')) return;
    
    try {
      const response = await fetch(`${API}/coupon/delete-coupons/${id}/hard`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete coupon');
      }

      setCoupons(coupons.filter(c => c._id !== id));
      toast.success('Coupon permanently deleted!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'flat',
      discountValue: '',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      minBookingValue: '',
      isGlobal: false,
      isFirstBooking: false,
      assignedTo: '',
      usageLimit: '',
      isActive: true
    });
  };

  // Open edit modal with coupon data
  const openEditModal = (coupon) => {
    setCurrentCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      expiryDate: new Date(coupon.expiryDate),
      minBookingValue: coupon.minBookingValue,
      isGlobal: coupon.isGlobal,
      isFirstBooking: coupon.isFirstBooking,
      assignedTo: coupon.assignedTo || '',
      usageLimit: coupon.usageLimit || '',
      isActive: coupon.isActive
    });
    setShowEditModal(true);
  };

  // Filter coupons based on selected filter
  const filteredCoupons = coupons.filter(coupon => {
    if (filter === 'active') return coupon.isActive && new Date(coupon.expiryDate) > new Date();
    if (filter === 'expired') return !coupon.isActive || new Date(coupon.expiryDate) <= new Date();
    if (filter === 'global') return coupon.isGlobal;
    if (filter === 'first-booking') return coupon.isFirstBooking;
    if (filter === 'assigned') return coupon.assignedTo;
    return true;
  }).filter(coupon => 
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.discountValue.toString().includes(searchTerm) ||
    (coupon.assignedTo && getUserName(coupon.assignedTo).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent rounded-full animate-ping border-t-blue-400 mx-auto"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading coupons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Error</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 p-8 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <h1 className="text-4xl font-bold mb-2">Coupon Management</h1>
                <p className="text-indigo-100 text-lg">Create and manage discount coupons for your customers</p>
              </div>
              
              <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:space-x-4">
                {/* Search Bar */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiSearch className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="w-full lg:w-80 pl-12 pr-4 py-3 rounded-2xl border-0 bg-white/90 focus:bg-white focus:outline-none focus:ring-4 focus:ring-white/30 transition-all placeholder-gray-500"
                    placeholder="Search coupons..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {/* Filter Dropdown */}
                <select
                  className="px-6 py-3 rounded-2xl border-0 bg-white/90 focus:bg-white focus:outline-none focus:ring-4 focus:ring-white/30 transition-all font-medium"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Coupons</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="global">Global</option>
                  <option value="first-booking">First Booking</option>
                  <option value="assigned">Assigned</option>
                </select>
                
                {/* Create Button */}
                <button
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl hover:from-emerald-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 flex items-center font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FiPlus className="mr-2 text-lg" />
                  Create Coupon
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Coupons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCoupons.length > 0 ? (
            filteredCoupons.map(coupon => (
              <div key={coupon._id} className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${!coupon.isActive ? 'opacity-60' : ''}`}>
                {/* Coupon Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 translate-y-10"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-white/20 p-3 rounded-xl">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                        </svg>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon._id)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Deactivate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleHardDeleteCoupon(coupon._id)}
                          className="p-2 bg-red-500/80 hover:bg-red-600/80 rounded-lg transition-colors"
                          title="Delete Permanently"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2">{coupon.code}</h3>
                    
                    <div className="flex items-center mb-3">
                      {coupon.discountType === 'flat' ? (
                        <div className="flex items-center text-2xl font-bold">
                          <FaRupeeSign className="mr-1" />
                          {coupon.discountValue}
                          <span className="text-sm font-normal ml-2">OFF</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-2xl font-bold">
                          {coupon.discountValue}
                          <FaPercentage className="ml-1 text-lg" />
                          <span className="text-sm font-normal ml-2">OFF</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Coupon Body */}
                <div className="p-6">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {coupon.isFirstBooking && (
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-semibold">First Booking</span>
                    )}
                    {coupon.isGlobal && (
                      <span className="px-3 py-1 bg-gradient-to-r from-green-100 to-emerald-200 text-green-700 rounded-full text-xs font-semibold">Global</span>
                    )}
                    {coupon.assignedTo && (
                      <span className="px-3 py-1 bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-700 rounded-full text-xs font-semibold">
                        {getUserName(coupon.assignedTo)}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Min Value:</span>
                      <span className="font-semibold">₹{coupon.minBookingValue || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Expires:</span>
                      <span className={`font-semibold ${new Date(coupon.expiryDate) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                        {new Date(coupon.expiryDate).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Usage Progress */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Usage:</span>
                        <span className="font-semibold text-gray-800">
                          {coupon.usedBy.length}/{coupon.usageLimit || '∞'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${coupon.usageLimit ? 
                              Math.min(100, (coupon.usedBy.length / coupon.usageLimit) * 100) : 
                              0}%` 
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="pt-3 border-t border-gray-100">
                      {coupon.isActive ? (
                        <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-green-100 to-emerald-200 text-green-700 rounded-full text-sm font-semibold">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                          <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No coupons found</h3>
                <p className="text-gray-600">No coupons match your current search criteria.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Create New Coupon</h3>
                    <p className="text-indigo-100">Add a new discount coupon for your customers</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                <form onSubmit={handleCreateCoupon}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coupon Code */}
                    <div className="md:col-span-1">
                      <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-3">Coupon Code *</label>
                      <input
                        type="text"
                        name="code"
                        id="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        required
                        pattern="[A-Z0-9_]{5,20}"
                        title="5-20 uppercase letters, numbers or underscores"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                        placeholder="SAVE20"
                      />
                      <p className="mt-2 text-xs text-gray-500">Uppercase letters, numbers and underscores only (5-20 chars)</p>
                    </div>

                    {/* Discount Type */}
                    <div className="md:col-span-1">
                      <label htmlFor="discountType" className="block text-sm font-semibold text-gray-700 mb-3">Discount Type *</label>
                      <select
                        id="discountType"
                        name="discountType"
                        value={formData.discountType}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                      >
                        <option value="flat">Flat Amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                    </div>

                    {/* Discount Value */}
                    <div className="md:col-span-1">
                      <label htmlFor="discountValue" className="block text-sm font-semibold text-gray-700 mb-3">Discount Value *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          {formData.discountType === 'percent' ? (
                            <FaPercentage className="text-gray-400" />
                          ) : (
                            <FaRupeeSign className="text-gray-400" />
                          )}
                        </div>
                        <input
                          type="number"
                          name="discountValue"
                          id="discountValue"
                          value={formData.discountValue}
                          onChange={handleInputChange}
                          required
                          min="1"
                          max={formData.discountType === 'percent' ? '100' : undefined}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                          placeholder={formData.discountType === 'percent' ? '10' : '100'}
                        />
                      </div>
                      {formData.discountType === 'percent' && (
                        <p className="mt-2 text-xs text-gray-500">Maximum 100%</p>
                      )}
                    </div>

                    {/* Minimum Booking Value */}
                    <div className="md:col-span-1">
                      <label htmlFor="minBookingValue" className="block text-sm font-semibold text-gray-700 mb-3">Minimum Booking Value</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaRupeeSign className="text-gray-400" />
                        </div>
                        <input
                          type="number"
                          name="minBookingValue"
                          id="minBookingValue"
                          value={formData.minBookingValue}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="md:col-span-1">
                      <label htmlFor="expiryDate" className="block text-sm font-semibold text-gray-700 mb-3">Expiry Date *</label>
                      <DatePicker
                        selected={formData.expiryDate}
                        onChange={handleDateChange}
                        minDate={new Date()}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                        required
                      />
                    </div>

                    {/* Usage Limit */}
                    <div className="md:col-span-1">
                      <label htmlFor="usageLimit" className="block text-sm font-semibold text-gray-700 mb-3">Usage Limit</label>
                      <input
                        type="number"
                        name="usageLimit"
                        id="usageLimit"
                        value={formData.usageLimit}
                        onChange={handleInputChange}
                        min="1"
                        placeholder="Leave empty for unlimited"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                      />
                    </div>

                    {/* Assign to User */}
                    <div className="md:col-span-2">
                      <label htmlFor="assignedTo" className="block text-sm font-semibold text-gray-700 mb-3">Assign to User (optional)</label>
                      <select
                        name="assignedTo"
                        id="assignedTo"
                        value={formData.assignedTo}
                        onChange={handleInputChange}
                        disabled={formData.isGlobal || formData.isFirstBooking}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Select a user</option>
                        {users.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-gray-500">
                        {formData.isGlobal || formData.isFirstBooking 
                          ? "Cannot assign to specific user when coupon is global or first-booking" 
                          : "Leave empty to make available to all users"}
                      </p>
                    </div>

                    {/* Checkboxes */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                        <input
                          id="isGlobal"
                          name="isGlobal"
                          type="checkbox"
                          checked={formData.isGlobal}
                          onChange={handleInputChange}
                          disabled={formData.isFirstBooking}
                          className="w-5 h-5 text-green-600 border-2 border-green-300 rounded focus:ring-green-500 focus:ring-2"
                        />
                        <label htmlFor="isGlobal" className="ml-3 text-sm font-medium text-green-800">
                          Global Coupon (available to all users)
                        </label>
                      </div>

                      <div className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                        <input
                          id="isFirstBooking"
                          name="isFirstBooking"
                          type="checkbox"
                          checked={formData.isFirstBooking}
                          onChange={handleInputChange}
                          disabled={formData.isGlobal}
                          className="w-5 h-5 text-purple-600 border-2 border-purple-300 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <label htmlFor="isFirstBooking" className="ml-3 text-sm font-medium text-purple-800">
                          First Booking Only (for new users)
                        </label>
                      </div>

                      <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                        <input
                          id="isActive"
                          name="isActive"
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={handleInputChange}
                          className="w-5 h-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <label htmlFor="isActive" className="ml-3 text-sm font-medium text-blue-800">
                          Active (coupon can be used)
                        </label>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-8 py-6 rounded-b-3xl flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCoupon}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all font-semibold shadow-lg"
                >
                  Create Coupon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coupon Modal */}
      {showEditModal && currentCoupon && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 text-white rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Edit Coupon: {currentCoupon.code}</h3>
                    <p className="text-orange-100">Modify coupon details and settings</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8">
                <form onSubmit={handleEditCoupon}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coupon Code */}
                    <div className="md:col-span-1">
                      <label htmlFor="editCode" className="block text-sm font-semibold text-gray-700 mb-3">Coupon Code</label>
                      <input
                        type="text"
                        name="code"
                        id="editCode"
                        value={formData.code}
                        onChange={handleInputChange}
                        required
                        pattern="[A-Z0-9_]{5,20}"
                        title="5-20 uppercase letters, numbers or underscores"
                        readOnly={currentCoupon.usedBy.length > 0}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-colors ${
                          currentCoupon.usedBy.length > 0 
                            ? 'border-gray-200 bg-gray-100 text-gray-500' 
                            : 'border-gray-200 focus:border-orange-500 focus:outline-none bg-gray-50 focus:bg-white'
                        }`}
                      />
                      {currentCoupon.usedBy.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500">Cannot modify code after usage</p>
                      )}
                    </div>

                    {/* Discount Type */}
                    <div className="md:col-span-1">
                      <label htmlFor="editDiscountType" className="block text-sm font-semibold text-gray-700 mb-3">Discount Type</label>
                      <select
                        id="editDiscountType"
                        name="discountType"
                        value={formData.discountType}
                        onChange={handleInputChange}
                        required
                        disabled={currentCoupon.usedBy.length > 0}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-colors ${
                          currentCoupon.usedBy.length > 0 
                            ? 'border-gray-200 bg-gray-100 text-gray-500' 
                            : 'border-gray-200 focus:border-orange-500 focus:outline-none bg-gray-50 focus:bg-white'
                        }`}
                      >
                        <option value="flat">Flat Amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                      {currentCoupon.usedBy.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500">Cannot modify type after usage</p>
                      )}
                    </div>

                    {/* Discount Value */}
                    <div className="md:col-span-1">
                      <label htmlFor="editDiscountValue" className="block text-sm font-semibold text-gray-700 mb-3">Discount Value</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          {formData.discountType === 'percent' ? (
                            <FaPercentage className="text-gray-400" />
                          ) : (
                            <FaRupeeSign className="text-gray-400" />
                          )}
                        </div>
                        <input
                          type="number"
                          name="discountValue"
                          id="editDiscountValue"
                          value={formData.discountValue}
                          onChange={handleInputChange}
                          required
                          min="1"
                          max={formData.discountType === 'percent' ? '100' : undefined}
                          disabled={currentCoupon.usedBy.length > 0}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-colors ${
                            currentCoupon.usedBy.length > 0 
                              ? 'border-gray-200 bg-gray-100 text-gray-500' 
                              : 'border-gray-200 focus:border-orange-500 focus:outline-none bg-gray-50 focus:bg-white'
                          }`}
                        />
                      </div>
                      {currentCoupon.usedBy.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500">Cannot modify value after usage</p>
                      )}
                    </div>

                    {/* Minimum Booking Value */}
                    <div className="md:col-span-1">
                      <label htmlFor="editMinBookingValue" className="block text-sm font-semibold text-gray-700 mb-3">Minimum Booking Value</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaRupeeSign className="text-gray-400" />
                        </div>
                        <input
                          type="number"
                          name="minBookingValue"
                          id="editMinBookingValue"
                          value={formData.minBookingValue}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="md:col-span-1">
                      <label htmlFor="editExpiryDate" className="block text-sm font-semibold text-gray-700 mb-3">Expiry Date *</label>
                      <DatePicker
                        selected={formData.expiryDate}
                        onChange={handleDateChange}
                        minDate={new Date()}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                        required
                      />
                    </div>

                    {/* Usage Limit */}
                    <div className="md:col-span-1">
                      <label htmlFor="editUsageLimit" className="block text-sm font-semibold text-gray-700 mb-3">Usage Limit</label>
                      <input
                        type="number"
                        name="usageLimit"
                        id="editUsageLimit"
                        value={formData.usageLimit}
                        onChange={handleInputChange}
                        min="1"
                        placeholder="Leave empty for unlimited"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                      />
                    </div>

                    {/* Assign to User */}
                    <div className="md:col-span-2">
                      <label htmlFor="editAssignedTo" className="block text-sm font-semibold text-gray-700 mb-3">Assign to User (optional)</label>
                      <select
                        name="assignedTo"
                        id="editAssignedTo"
                        value={formData.assignedTo}
                        onChange={handleInputChange}
                        disabled={currentCoupon.usedBy.length > 0 || formData.isGlobal || formData.isFirstBooking}
                        className={`w-full px-4 py-3 rounded-xl border-2 transition-colors ${
                          currentCoupon.usedBy.length > 0 || formData.isGlobal || formData.isFirstBooking
                            ? 'border-gray-200 bg-gray-100 text-gray-500'
                            : 'border-gray-200 focus:border-orange-500 focus:outline-none bg-gray-50 focus:bg-white'
                        }`}
                      >
                        <option value="">Select a user</option>
                        {users.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-gray-500">
                        {currentCoupon.usedBy.length > 0 
                          ? "Cannot modify after usage" 
                          : formData.isGlobal || formData.isFirstBooking
                            ? "Cannot assign to specific user when coupon is global or first-booking"
                            : "Leave empty to make available to all users"}
                      </p>
                    </div>

                    {/* Checkboxes */}
                    <div className="md:col-span-2 space-y-4">
                      <div className={`flex items-center p-4 rounded-xl border ${
                        currentCoupon.usedBy.length > 0 || formData.isFirstBooking
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      }`}>
                        <input
                          id="editIsGlobal"
                          name="isGlobal"
                          type="checkbox"
                          checked={formData.isGlobal}
                          onChange={handleInputChange}
                          disabled={currentCoupon.usedBy.length > 0 || formData.isFirstBooking}
                          className="w-5 h-5 text-green-600 border-2 border-green-300 rounded focus:ring-green-500 focus:ring-2"
                        />
                        <label htmlFor="editIsGlobal" className={`ml-3 text-sm font-medium ${
                          currentCoupon.usedBy.length > 0 || formData.isFirstBooking
                            ? 'text-gray-500'
                            : 'text-green-800'
                        }`}>
                          Global Coupon
                        </label>
                      </div>

                      <div className={`flex items-center p-4 rounded-xl border ${
                        currentCoupon.usedBy.length > 0 || formData.isGlobal
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
                      }`}>
                        <input
                          id="editIsFirstBooking"
                          name="isFirstBooking"
                          type="checkbox"
                          checked={formData.isFirstBooking}
                          onChange={handleInputChange}
                          disabled={currentCoupon.usedBy.length > 0 || formData.isGlobal}
                          className="w-5 h-5 text-purple-600 border-2 border-purple-300 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <label htmlFor="editIsFirstBooking" className={`ml-3 text-sm font-medium ${
                          currentCoupon.usedBy.length > 0 || formData.isGlobal
                            ? 'text-gray-500'
                            : 'text-purple-800'
                        }`}>
                          First Booking Only
                        </label>
                      </div>

                      <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                        <input
                          id="editIsActive"
                          name="isActive"
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={handleInputChange}
                          className="w-5 h-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <label htmlFor="editIsActive" className="ml-3 text-sm font-medium text-blue-800">
                          Active (coupon can be used)
                        </label>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-8 py-6 rounded-b-3xl flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditCoupon}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-orange-300 transition-all font-semibold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoupons;