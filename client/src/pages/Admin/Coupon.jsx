import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import { FiEdit, FiTrash2, FiX, FiPlus, FiSearch, FiUsers, FiGlobe, FiStar } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const AdminCoupons = () => {
  const { API, isAdmin } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState(null);

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

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API}/admin/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/coupon/admin/coupons`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCoupons(data.data || []);
      }
    } catch (err) {
      toast.error('Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchCoupons();
      fetchUsers();
    }
  }, [isAdmin]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'isGlobal' && checked) {
      setFormData(prev => ({
        ...prev,
        isGlobal: true,
        isFirstBooking: false,
        assignedTo: ''
      }));
    } else if (name === 'isFirstBooking' && checked) {
      setFormData(prev => ({
        ...prev,
        isFirstBooking: true,
        isGlobal: false,
        assignedTo: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      expiryDate: date
    }));
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/coupon/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          expiryDate: formData.expiryDate.toISOString(),
          assignedTo: formData.assignedTo || null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCoupons([data.data, ...coupons]);
        setShowCreateModal(false);
        toast.success('Coupon created successfully!');
        resetForm();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create coupon');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditCoupon = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        ...formData,
        expiryDate: formData.expiryDate.toISOString(),
        assignedTo: formData.assignedTo || null
      };
      
      if (currentCoupon.usedBy.length > 0) {
        delete updateData.code;
        delete updateData.discountType;
        delete updateData.discountValue;
        delete updateData.isGlobal;
        delete updateData.isFirstBooking;
      }
      
      const response = await fetch(`${API}/coupon/admin/coupon/${currentCoupon._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setCoupons(coupons.map(c => c._id === data.data._id ? data.data : c));
        setShowEditModal(false);
        toast.success('Coupon updated successfully!');
        resetForm();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update coupon');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this coupon?')) return;
    
    try {
      const response = await fetch(`${API}/coupon/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setCoupons(coupons.map(c => c._id === id ? { ...c, isActive: false } : c));
        toast.success('Coupon deactivated successfully!');
      } else {
        throw new Error('Failed to delete coupon');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

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

  const filteredCoupons = coupons.filter(coupon => {
    if (filter === 'active') return coupon.isActive && new Date(coupon.expiryDate) > new Date();
    if (filter === 'expired') return !coupon.isActive || new Date(coupon.expiryDate) <= new Date();
    if (filter === 'global') return coupon.isGlobal;
    if (filter === 'first-booking') return coupon.isFirstBooking;
    if (filter === 'assigned') return coupon.assignedTo;
    return true;
  }).filter(coupon => 
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.discountValue.toString().includes(searchTerm)
  );

  const getUserName = (userId) => {
    if (!userId) return null;
    const user = users.find(u => u._id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.3
      }
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-200">
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

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-gray-50 to-teal-50/30">
      <div className="container mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200 p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <h1 className="text-3xl font-bold text-secondary flex items-center gap-3">
                <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                Coupon Management
              </h1>
              <p className="text-gray-600 mt-2">Create and manage discount coupons</p>
            </div>
            <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:space-x-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="text"
                  className="w-full lg:w-80 pl-12 pr-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                  placeholder="Search coupons..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="w-full lg:w-auto px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-accent text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center"
                onClick={() => setShowCreateModal(true)}
              >
                <FiPlus className="mr-2" />
                Create Coupon
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Coupons Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-primary/20 rounded-full border-t-primary"
            />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredCoupons.length > 0 ? (
              filteredCoupons.map(coupon => (
                <motion.div
                  key={coupon._id}
                  variants={itemVariants}
                  className={`bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1 ${!coupon.isActive ? 'opacity-75' : ''}`}
                >
                  <div className="bg-gradient-to-r from-primary to-teal-700 p-6 text-white relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                          </svg>
                        </div>
                        <div className="flex space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => openEditModal(coupon)}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                            title="Edit"
                          >
                            <FiEdit className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteCoupon(coupon._id)}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                            title="Deactivate"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </motion.button>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{coupon.code}</h3>
                      <div className="flex items-center mb-3">
                        {coupon.discountType === 'flat' ? (
                          <div className="flex items-center text-2xl font-bold">
                            ₹{coupon.discountValue}
                            <span className="text-sm font-normal ml-2">OFF</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-2xl font-bold">
                            {coupon.discountValue}%
                            <span className="text-sm font-normal ml-2">OFF</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {coupon.isFirstBooking && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold flex items-center">
                          <FiStar className="mr-1" /> First Booking
                        </span>
                      )}
                      {coupon.isGlobal && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center">
                          <FiGlobe className="mr-1" /> Global
                        </span>
                      )}
                      {coupon.assignedTo && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center">
                          <FiUsers className="mr-1" /> Assigned
                        </span>
                      )}
                    </div>
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
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600">Usage:</span>
                          <span className="font-semibold text-gray-800">
                            {coupon.usedBy.length}/{coupon.usageLimit || '∞'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${coupon.usageLimit ? Math.min(100, (coupon.usedBy.length / coupon.usageLimit) * 100) : 0}%` }}
                            transition={{ duration: 0.5 }}
                            className="bg-primary h-2.5 rounded-full"
                          />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-100">
                        {coupon.isActive ? (
                          <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-2 h-2 bg-green-500 rounded-full mr-2"
                            />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                variants={itemVariants}
                className="col-span-full bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-12 text-center border border-gray-200"
              >
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No coupons found</h3>
                <p className="text-gray-600">No coupons match your current search criteria.</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Create Coupon Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200"
              >
                <div className="bg-gradient-to-r from-primary to-teal-700 p-6 text-white rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Create New Coupon</h3>
                      <p className="text-teal-100">Add a new discount coupon for your customers</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                    >
                      <FiX className="w-6 h-6" />
                    </motion.button>
                  </div>
                </div>
                <div className="p-6">
                  <form onSubmit={handleCreateCoupon}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">Coupon Code *</label>
                        <input
                          type="text"
                          name="code"
                          id="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          required
                          pattern="[A-Z0-9_]{5,20}"
                          title="5-20 uppercase letters, numbers or underscores"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                          placeholder="SAVE20"
                        />
                        <p className="mt-2 text-xs text-gray-500">Uppercase letters, numbers and underscores only (5-20 chars)</p>
                      </div>
                      <div>
                        <label htmlFor="discountType" className="block text-sm font-semibold text-gray-700 mb-2">Discount Type *</label>
                        <select
                          id="discountType"
                          name="discountType"
                          value={formData.discountType}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                        >
                          <option value="flat">Flat Amount</option>
                          <option value="percent">Percentage</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="discountValue" className="block text-sm font-semibold text-gray-700 mb-2">Discount Value *</label>
                        <input
                          type="number"
                          name="discountValue"
                          id="discountValue"
                          value={formData.discountValue}
                          onChange={handleInputChange}
                          required
                          min="1"
                          max={formData.discountType === 'percent' ? '100' : undefined}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                          placeholder={formData.discountType === 'percent' ? '10' : '100'}
                        />
                        {formData.discountType === 'percent' && (
                          <p className="mt-2 text-xs text-gray-500">Maximum 100%</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="minBookingValue" className="block text-sm font-semibold text-gray-700 mb-2">Minimum Booking Value</label>
                        <input
                          type="number"
                          name="minBookingValue"
                          id="minBookingValue"
                          value={formData.minBookingValue}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="expiryDate" className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
                        <DatePicker
                          selected={formData.expiryDate}
                          onChange={handleDateChange}
                          minDate={new Date()}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="usageLimit" className="block text-sm font-semibold text-gray-700 mb-2">Usage Limit</label>
                        <input
                          type="number"
                          name="usageLimit"
                          id="usageLimit"
                          value={formData.usageLimit}
                          onChange={handleInputChange}
                          min="1"
                          placeholder="Leave empty for unlimited"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="assignedTo" className="block text-sm font-semibold text-gray-700 mb-2">Assign to User (optional)</label>
                        <select
                          name="assignedTo"
                          id="assignedTo"
                          value={formData.assignedTo}
                          onChange={handleInputChange}
                          disabled={formData.isGlobal || formData.isFirstBooking}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 hover:border-primary/30 disabled:bg-gray-100/50 disabled:text-gray-500"
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
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center p-4 bg-green-50/50 rounded-xl border border-green-200">
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
                        <div className="flex items-center p-4 bg-purple-50/50 rounded-xl border border-purple-200">
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
                        <div className="flex items-center p-4 bg-blue-50/50 rounded-xl border border-blue-200">
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
                    <div className="flex justify-end gap-3 pt-6">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          resetForm();
                        }}
                        className="px-6 py-3 bg-gray-500 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="px-6 py-3 bg-accent text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Create Coupon
                      </motion.button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Coupon Modal */}
        <AnimatePresence>
          {showEditModal && currentCoupon && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200"
              >
                <div className="bg-gradient-to-r from-accent to-orange-600 p-6 text-white rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Edit Coupon: {currentCoupon.code}</h3>
                      <p className="text-orange-100">Modify coupon details and settings</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setShowEditModal(false);
                        resetForm();
                      }}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                    >
                      <FiX className="w-6 h-6" />
                    </motion.button>
                  </div>
                </div>
                <div className="p-6">
                  <form onSubmit={handleEditCoupon}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="editCode" className="block text-sm font-semibold text-gray-700 mb-2">Coupon Code</label>
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
                          className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30 ${currentCoupon.usedBy.length > 0 ? 'bg-gray-100/50 text-gray-500' : 'bg-gray-50/50'}`}
                        />
                        {currentCoupon.usedBy.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">Cannot modify code after usage</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="editDiscountType" className="block text-sm font-semibold text-gray-700 mb-2">Discount Type</label>
                        <select
                          id="editDiscountType"
                          name="discountType"
                          value={formData.discountType}
                          onChange={handleInputChange}
                          required
                          disabled={currentCoupon.usedBy.length > 0}
                          className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30 ${currentCoupon.usedBy.length > 0 ? 'bg-gray-100/50 text-gray-500' : 'bg-gray-50/50'}`}
                        >
                          <option value="flat">Flat Amount</option>
                          <option value="percent">Percentage</option>
                        </select>
                        {currentCoupon.usedBy.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">Cannot modify type after usage</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="editDiscountValue" className="block text-sm font-semibold text-gray-700 mb-2">Discount Value</label>
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
                          className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30 ${currentCoupon.usedBy.length > 0 ? 'bg-gray-100/50 text-gray-500' : 'bg-gray-50/50'}`}
                        />
                        {currentCoupon.usedBy.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">Cannot modify value after usage</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="editMinBookingValue" className="block text-sm font-semibold text-gray-700 mb-2">Minimum Booking Value</label>
                        <input
                          type="number"
                          name="minBookingValue"
                          id="editMinBookingValue"
                          value={formData.minBookingValue}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30"
                        />
                      </div>
                      <div>
                        <label htmlFor="editExpiryDate" className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
                        <DatePicker
                          selected={formData.expiryDate}
                          onChange={handleDateChange}
                          minDate={new Date()}
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="editUsageLimit" className="block text-sm font-semibold text-gray-700 mb-2">Usage Limit</label>
                        <input
                          type="number"
                          name="usageLimit"
                          id="editUsageLimit"
                          value={formData.usageLimit}
                          onChange={handleInputChange}
                          min="1"
                          placeholder="Leave empty for unlimited"
                          className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="editAssignedTo" className="block text-sm font-semibold text-gray-700 mb-2">Assign to User (optional)</label>
                        <select
                          name="assignedTo"
                          id="editAssignedTo"
                          value={formData.assignedTo}
                          onChange={handleInputChange}
                          disabled={currentCoupon.usedBy.length > 0 || formData.isGlobal || formData.isFirstBooking}
                          className={`w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent/30 ${currentCoupon.usedBy.length > 0 || formData.isGlobal || formData.isFirstBooking ? 'bg-gray-100/50 text-gray-500' : 'bg-gray-50/50'}`}
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
                      <div className="md:col-span-2 space-y-4">
                        <div className={`flex items-center p-4 rounded-xl border ${currentCoupon.usedBy.length > 0 || formData.isFirstBooking ? 'bg-gray-100/50 border-gray-200' : 'bg-green-50/50 border-green-200'}`}>
                          <input
                            id="editIsGlobal"
                            name="isGlobal"
                            type="checkbox"
                            checked={formData.isGlobal}
                            onChange={handleInputChange}
                            disabled={currentCoupon.usedBy.length > 0 || formData.isFirstBooking}
                            className="w-5 h-5 text-green-600 border-2 border-green-300 rounded focus:ring-green-500 focus:ring-2"
                          />
                          <label htmlFor="editIsGlobal" className={`ml-3 text-sm font-medium ${currentCoupon.usedBy.length > 0 || formData.isFirstBooking ? 'text-gray-500' : 'text-green-800'}`}>
                            Global Coupon
                          </label>
                        </div>
                        <div className={`flex items-center p-4 rounded-xl border ${currentCoupon.usedBy.length > 0 || formData.isGlobal ? 'bg-gray-100/50 border-gray-200' : 'bg-purple-50/50 border-purple-200'}`}>
                          <input
                            id="editIsFirstBooking"
                            name="isFirstBooking"
                            type="checkbox"
                            checked={formData.isFirstBooking}
                            onChange={handleInputChange}
                            disabled={currentCoupon.usedBy.length > 0 || formData.isGlobal}
                            className="w-5 h-5 text-purple-600 border-2 border-purple-300 rounded focus:ring-purple-500 focus:ring-2"
                          />
                          <label htmlFor="editIsFirstBooking" className={`ml-3 text-sm font-medium ${currentCoupon.usedBy.length > 0 || formData.isGlobal ? 'text-gray-500' : 'text-purple-800'}`}>
                            First Booking Only
                          </label>
                        </div>
                        <div className="flex items-center p-4 bg-blue-50/50 rounded-xl border border-blue-200">
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
                    <div className="flex justify-end gap-3 pt-6">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          resetForm();
                        }}
                        className="px-6 py-3 bg-gray-500 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="px-6 py-3 bg-accent text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Save Changes
                      </motion.button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminCoupons;