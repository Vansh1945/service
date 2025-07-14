import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AdminCoupons = () => {
  const { API, isAdmin, logoutUser } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
      setCoupons(data.data);
      setTotalPages(Math.ceil(data.count / 10));
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
    }
  }, [isAdmin, filter, searchTerm, currentPage]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
      const response = await fetch(`${API}/coupon/add-coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          expiryDate: formData.expiryDate.toISOString()
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
        expiryDate: formData.expiryDate.toISOString()
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

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error messages from backend
        if (data.error && data.error.includes('duplicate key')) {
          throw new Error('Coupon code already exists');
        }
        throw new Error(data.message || 'Failed to update coupon');
      }

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
    coupon.discountValue.toString().includes(searchTerm)
  );

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md">
          <p className="font-medium">Access Denied</p>
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-md overflow-hidden p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">Coupon Management</h2>
          
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
            <div className="relative">
              <input
                type="text"
                className="w-full md:w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search coupons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <select
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            
            <button
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center"
              onClick={() => setShowCreateModal(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Coupon
            </button>
          </div>
        </div>

        {/* Coupons Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Value</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCoupons.length > 0 ? (
                filteredCoupons.map(coupon => (
                  <tr key={coupon._id} className={!coupon.isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{coupon.code}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {coupon.isFirstBooking && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">First Booking</span>
                            )}
                            {coupon.isGlobal && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Global</span>
                            )}
                            {coupon.assignedTo && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {coupon.discountType === 'flat' ? (
                          <span className="text-green-600">₹{coupon.discountValue} OFF</span>
                        ) : (
                          <span className="text-green-600">{coupon.discountValue}% OFF</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                        {coupon.discountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ₹{coupon.minBookingValue || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(coupon.expiryDate).toLocaleDateString()}
                        {new Date(coupon.expiryDate) < new Date() && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ 
                              width: `${coupon.usageLimit ? 
                                Math.min(100, (coupon.usedBy.length / coupon.usageLimit) * 100) : 
                                0}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">
                          {coupon.usedBy.length}/{coupon.usageLimit || '∞'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {coupon.isActive ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon._id)}
                          className="text-yellow-600 hover:text-yellow-900 p-1 rounded-full hover:bg-yellow-50"
                          title="Deactivate"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleHardDeleteCoupon(coupon._id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                          title="Delete Permanently"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                    No coupons found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * 10, filteredCoupons.length)}</span> of{' '}
                  <span className="font-medium">{filteredCoupons.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page 
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Create New Coupon</h3>
                    <div className="mt-2">
                      <form onSubmit={handleCreateCoupon}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-3">
                            <label htmlFor="code" className="block text-sm font-medium text-gray-700">Coupon Code</label>
                            <input
                              type="text"
                              name="code"
                              id="code"
                              value={formData.code}
                              onChange={handleInputChange}
                              required
                              pattern="[A-Z0-9_]{5,20}"
                              title="5-20 uppercase letters, numbers or underscores"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">Discount Type</label>
                            <select
                              id="discountType"
                              name="discountType"
                              value={formData.discountType}
                              onChange={handleInputChange}
                              required
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="flat">Flat Amount</option>
                              <option value="percent">Percentage</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Discount Value</label>
                            <input
                              type="number"
                              name="discountValue"
                              id="discountValue"
                              value={formData.discountValue}
                              onChange={handleInputChange}
                              required
                              min="1"
                              max={formData.discountType === 'percent' ? '100' : undefined}
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="minBookingValue" className="block text-sm font-medium text-gray-700">Minimum Booking Value</label>
                            <input
                              type="number"
                              name="minBookingValue"
                              id="minBookingValue"
                              value={formData.minBookingValue}
                              onChange={handleInputChange}
                              min="0"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">Expiry Date</label>
                            <DatePicker
                              selected={formData.expiryDate}
                              onChange={handleDateChange}
                              minDate={new Date()}
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                              required
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="usageLimit" className="block text-sm font-medium text-gray-700">Usage Limit</label>
                            <input
                              type="number"
                              name="usageLimit"
                              id="usageLimit"
                              value={formData.usageLimit}
                              onChange={handleInputChange}
                              min="1"
                              placeholder="Leave empty for unlimited"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="isGlobal"
                                name="isGlobal"
                                type="checkbox"
                                checked={formData.isGlobal}
                                onChange={handleInputChange}
                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                              <label htmlFor="isGlobal" className="ml-2 block text-sm text-gray-700">Global Coupon</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="isFirstBooking"
                                name="isFirstBooking"
                                type="checkbox"
                                checked={formData.isFirstBooking}
                                onChange={handleInputChange}
                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                              <label htmlFor="isFirstBooking" className="ml-2 block text-sm text-gray-700">First Booking Only</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="isActive"
                                name="isActive"
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={handleInputChange}
                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">Active</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700">Assign to User (optional)</label>
                            <input
                              type="text"
                              name="assignedTo"
                              id="assignedTo"
                              value={formData.assignedTo}
                              onChange={handleInputChange}
                              placeholder="User ID"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateCoupon}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Create Coupon
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coupon Modal */}
      {showEditModal && currentCoupon && (
        <div className="fixed inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => {
              setShowEditModal(false);
              resetForm();
            }}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Edit Coupon: {currentCoupon.code}</h3>
                    <div className="mt-2">
                      <form onSubmit={handleEditCoupon}>
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                          <div className="sm:col-span-3">
                            <label htmlFor="editCode" className="block text-sm font-medium text-gray-700">Coupon Code</label>
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
                              className={`mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md ${
                                currentCoupon.usedBy.length > 0 ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="editDiscountType" className="block text-sm font-medium text-gray-700">Discount Type</label>
                            <select
                              id="editDiscountType"
                              name="discountType"
                              value={formData.discountType}
                              onChange={handleInputChange}
                              required
                              disabled={currentCoupon.usedBy.length > 0}
                              className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                                currentCoupon.usedBy.length > 0 ? 'bg-gray-100' : ''
                              }`}
                            >
                              <option value="flat">Flat Amount</option>
                              <option value="percent">Percentage</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="editDiscountValue" className="block text-sm font-medium text-gray-700">Discount Value</label>
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
                              className={`mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md ${
                                currentCoupon.usedBy.length > 0 ? 'bg-gray-100' : ''
                              }`}
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="editMinBookingValue" className="block text-sm font-medium text-gray-700">Minimum Booking Value</label>
                            <input
                              type="number"
                              name="minBookingValue"
                              id="editMinBookingValue"
                              value={formData.minBookingValue}
                              onChange={handleInputChange}
                              min="0"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="editExpiryDate" className="block text-sm font-medium text-gray-700">Expiry Date</label>
                            <DatePicker
                              selected={formData.expiryDate}
                              onChange={handleDateChange}
                              minDate={new Date()}
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                              required
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor="editUsageLimit" className="block text-sm font-medium text-gray-700">Usage Limit</label>
                            <input
                              type="number"
                              name="usageLimit"
                              id="editUsageLimit"
                              value={formData.usageLimit}
                              onChange={handleInputChange}
                              min="1"
                              placeholder="Leave empty for unlimited"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="editIsGlobal"
                                name="isGlobal"
                                type="checkbox"
                                checked={formData.isGlobal}
                                onChange={handleInputChange}
                                disabled={currentCoupon.usedBy.length > 0 || formData.isFirstBooking}
                                className={`focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded ${
                                  currentCoupon.usedBy.length > 0 || formData.isFirstBooking ? 'bg-gray-100' : ''
                                }`}
                              />
                              <label htmlFor="editIsGlobal" className="ml-2 block text-sm text-gray-700">Global Coupon</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="editIsFirstBooking"
                                name="isFirstBooking"
                                type="checkbox"
                                checked={formData.isFirstBooking}
                                onChange={handleInputChange}
                                disabled={currentCoupon.usedBy.length > 0 || formData.isGlobal}
                                className={`focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded ${
                                  currentCoupon.usedBy.length > 0 || formData.isGlobal ? 'bg-gray-100' : ''
                                }`}
                              />
                              <label htmlFor="editIsFirstBooking" className="ml-2 block text-sm text-gray-700">First Booking Only</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <div className="flex items-center">
                              <input
                                id="editIsActive"
                                name="isActive"
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={handleInputChange}
                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                              />
                              <label htmlFor="editIsActive" className="ml-2 block text-sm text-gray-700">Active</label>
                            </div>
                          </div>

                          <div className="sm:col-span-6">
                            <label htmlFor="editAssignedTo" className="block text-sm font-medium text-gray-700">Assign to User (optional)</label>
                            <input
                              type="text"
                              name="assignedTo"
                              id="editAssignedTo"
                              value={formData.assignedTo}
                              onChange={handleInputChange}
                              placeholder="User ID"
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleEditCoupon}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
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