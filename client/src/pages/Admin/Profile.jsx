import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../store/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiUser, FiMail, FiLock, FiX, FiPlus, FiShield, FiUsers, 
  FiSearch, FiChevronLeft, FiChevronRight, FiCalendar, 
  FiEdit, FiEye, FiEyeOff, FiUpload, FiTrash2, FiLoader 
} from 'react-icons/fi';

// Debounce hook for search optimization
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const AdminProfile = () => {
  const { user, logoutUser, API } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    profilePic: null
  });
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    profilePic: null,
    profilePicPreview: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Admin list state
  const [admins, setAdmins] = useState([]);
  const [adminStats, setAdminStats] = useState({ total: 0, page: 1, pages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdminList, setShowAdminList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch admin profile
  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API}/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch profile');
      
      setProfile(data.admin);
      // Set edit data with current profile values
      setEditData({
        name: data.admin.name,
        email: data.admin.email,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        profilePic: null,
        profilePicPreview: data.admin.profilePicUrl || ''
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle register form changes
  const handleRegisterChange = (e) => {
    if (e.target.name === 'profilePic') {
      setRegisterData({
        ...registerData,
        profilePic: e.target.files[0]
      });
    } else {
      setRegisterData({
        ...registerData,
        [e.target.name]: e.target.value
      });
    }
  };

  // Handle edit form changes
  const handleEditChange = (e) => {
    if (e.target.name === 'profilePic') {
      const file = e.target.files[0];
      setEditData({
        ...editData,
        profilePic: file,
        profilePicPreview: file ? URL.createObjectURL(file) : editData.profilePicPreview
      });
    } else {
      setEditData({
        ...editData,
        [e.target.name]: e.target.value
      });
    }
  };

  // Handle new admin registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      if (registerData.password !== registerData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const formData = new FormData();
      formData.append('name', registerData.name);
      formData.append('email', registerData.email);
      formData.append('password', registerData.password);
      if (registerData.profilePic) {
        formData.append('profilePic', registerData.profilePic);
      }

      const response = await fetch(`${API}/admin/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');

      toast.success('New admin registered successfully!');
      setIsRegisterOpen(false);
      setRegisterData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        profilePic: null
      });
      
      // Refresh admin list if it's currently shown
      if (showAdminList) {
        fetchAdmins();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle profile update
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      if (editData.newPassword && editData.newPassword !== editData.confirmNewPassword) {
        throw new Error('New passwords do not match');
      }

      const formData = new FormData();
      formData.append('name', editData.name);
      formData.append('email', editData.email);
      if (editData.currentPassword) formData.append('currentPassword', editData.currentPassword);
      if (editData.newPassword) formData.append('newPassword', editData.newPassword);
      if (editData.profilePic) formData.append('profilePic', editData.profilePic);

      const response = await fetch(`${API}/admin/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Update failed');

      toast.success('Profile updated successfully!');
      setIsEditOpen(false);
      setProfile(data.admin);
      
      // Reset password fields only
      setEditData({
        ...editData,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch all admins
  const fetchAdmins = useCallback(async (page = 1, search = '') => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      });

      const response = await fetch(`${API}/admin/admins?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch admins');

      setAdmins(data.admins);
      setAdminStats({
        total: data.total,
        page: data.page,
        pages: data.pages
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  // Delete admin
  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Are you sure you want to delete this admin?')) {
      return;
    }

    try {
      const response = await fetch(`${API}/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete admin');

      toast.success('Admin deleted successfully!');
      fetchAdmins(currentPage, searchTerm);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Toggle admin list view
  const toggleAdminList = () => {
    setShowAdminList(!showAdminList);
  };

  // Fetch admins when search term or page changes
  useEffect(() => {
    if (showAdminList) {
      fetchAdmins(currentPage, debouncedSearchTerm);
    }
  }, [currentPage, debouncedSearchTerm, showAdminList, fetchAdmins]);

  // Memoized admin list component
  const AdminList = useMemo(() => {
    if (!showAdminList) return null;

    return (
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mt-4">
        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative mb-4 sm:mb-0 flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search admins by name or email..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="text-sm text-secondary whitespace-nowrap">
            Total Admins: <span className="font-semibold">{adminStats.total}</span>
          </div>
        </div>

        {/* Admin List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : admins.length > 0 ? (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div key={admin._id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <div className="flex items-center space-x-3 mb-3 sm:mb-0">
                    <img 
                      src={admin.profilePicUrl || '/default-avatar.png'} 
                      alt={admin.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-medium text-secondary truncate">{admin.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 justify-between sm:justify-end">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <FiCalendar className="mr-1 flex-shrink-0" />
                        <span className="truncate">Joined {new Date(admin.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}</span>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        <FiShield className="mr-1" />
                        Administrator
                      </span>
                    </div>
                    {admin._id !== profile?._id && (
                      <button
                        onClick={() => handleDeleteAdmin(admin._id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition flex-shrink-0"
                        title="Delete Admin"
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>
                {/* Mobile view details */}
                <div className="sm:hidden mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center text-sm text-gray-500">
                    <FiCalendar className="mr-1" />
                    Joined {new Date(admin.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FiUsers className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary">No admins found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'No administrators are registered yet.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {admins.length > 0 && adminStats.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-200 space-y-4 sm:space-y-0">
            <div className="text-sm text-secondary">
              Showing page {adminStats.page} of {adminStats.pages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="mr-1" />
                Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === adminStats.pages}
                className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <FiChevronRight className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }, [showAdminList, searchTerm, adminStats, isLoading, admins, currentPage, profile, handleDeleteAdmin, handlePageChange]);

  if (isLoading && !profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header with Register Button */}
          <div className="bg-gradient-to-r from-primary to-teal-700 px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <div className="flex items-center mb-4 sm:mb-0">
                <div className="relative mr-3 sm:mr-4">
                  <img 
                    src={profile?.profilePicUrl || '/default-avatar.png'} 
                    alt={profile?.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-white bg-white object-cover"
                  />
                  <button 
                    onClick={() => setIsEditOpen(true)}
                    className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full text-xs sm:text-sm"
                  >
                    <FiEdit size={12} />
                  </button>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Dashboard</h1>
                  <p className="mt-1 text-teal-100 text-sm sm:text-base">Welcome, {profile?.name}</p>
                </div>
              </div>
              
              {/* Register New Admin Button */}
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="flex items-center px-3 py-2 sm:px-4 sm:py-2 bg-white text-primary rounded-lg hover:bg-teal-50 transition text-sm sm:text-base"
              >
                <FiPlus className="mr-1 sm:mr-2" />
                Register New Admin
              </button>
            </div>
          </div>

          {/* Profile Information */}
          <div className="px-4 sm:px-6 py-6 sm:py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-teal-50 p-4 sm:p-6 rounded-lg">
                <h2 className="text-lg font-medium text-teal-800 mb-3 sm:mb-4">
                  <FiUser className="inline mr-2" />
                  Personal Information
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-sm text-teal-600">Full Name</p>
                    <p className="text-base sm:text-lg font-medium truncate">{profile?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-teal-600">Email Address</p>
                    <p className="text-base sm:text-lg font-medium truncate">{profile?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-teal-600">Profile Picture</p>
                    <div className="mt-2">
                      <img 
                        src={profile?.profilePicUrl || '/default-avatar.png'} 
                        alt={profile?.name}
                        className="w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-teal-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg">
                <h2 className="text-lg font-medium text-secondary mb-3 sm:mb-4">
                  <FiShield className="inline mr-2" />
                  Account Details
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-sm text-secondary">Role</p>
                    <p className="text-base sm:text-lg font-medium">Administrator</p>
                  </div>
                  <div>
                    <p className="text-sm text-secondary">Member Since</p>
                    <p className="text-base sm:text-lg font-medium">
                      {profile && new Date(profile.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-secondary">Last Updated</p>
                    <p className="text-base sm:text-lg font-medium">
                      {profile && new Date(profile.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* View All Admins Section */}
            <div className="mt-6 sm:mt-8 border-t border-gray-200 pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl font-semibold text-secondary mb-3 sm:mb-0">
                  <FiUsers className="inline mr-2" />
                  Admin Management
                </h2>
                <button
                  onClick={toggleAdminList}
                  className="flex items-center px-3 py-2 sm:px-4 sm:py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <FiUsers className="mr-1 sm:mr-2" />
                  {showAdminList ? 'Hide Admin List' : 'View All Admins'}
                </button>
              </div>

              {AdminList}
            </div>

            <div className="mt-6 sm:mt-8 border-t border-gray-200 pt-4 sm:pt-6">
              <button
                onClick={logoutUser}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-700 transition w-full sm:w-auto"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => !isSubmitting && setIsRegisterOpen(false)}
            ></div>

            {/* Modal content */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                {/* Modal header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-secondary">
                      <FiShield className="inline mr-2 text-primary" />
                      Register New Admin
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Enter details for the new administrator</p>
                  </div>
                  <button
                    onClick={() => !isSubmitting && setIsRegisterOpen(false)}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    <FiX size={24} />
                  </button>
                </div>

                {/* Registration form */}
                <form onSubmit={handleRegisterSubmit} className="mt-4 sm:mt-6 space-y-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={registerData.name}
                        onChange={handleRegisterChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        placeholder="Email Address"
                        value={registerData.email}
                        onChange={handleRegisterChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Password"
                        value={registerData.password}
                        onChange={handleRegisterChange}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        minLength="6"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isSubmitting}
                      >
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>

                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={registerData.confirmPassword}
                        onChange={handleRegisterChange}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Profile Picture (Optional)
                      </label>
                      <div className="flex items-center">
                        <label className={`flex flex-col items-center px-4 py-2 bg-white text-primary rounded-lg border border-primary cursor-pointer hover:bg-teal-50 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <FiUpload className="mr-2" />
                          <span>Choose File</span>
                          <input
                            type="file"
                            name="profilePic"
                            onChange={handleRegisterChange}
                            className="hidden"
                            accept="image/*"
                            disabled={isSubmitting}
                          />
                        </label>
                        {registerData.profilePic && (
                          <span className="ml-3 text-sm text-secondary truncate">
                            {registerData.profilePic.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsRegisterOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-secondary hover:bg-gray-50 transition disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 flex items-center"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && <FiLoader className="animate-spin mr-2" />}
                      Register Admin
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => !isSubmitting && setIsEditOpen(false)}
            ></div>

            {/* Modal content */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                {/* Modal header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-secondary">
                      <FiUser className="inline mr-2 text-primary" />
                      Edit Profile
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">Update your profile information</p>
                  </div>
                  <button
                    onClick={() => !isSubmitting && setIsEditOpen(false)}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    <FiX size={24} />
                  </button>
                </div>

                {/* Edit form */}
                <form onSubmit={handleEditSubmit} className="mt-4 sm:mt-6 space-y-4">
                  <div className="space-y-4">
                    <div className="flex flex-col items-center mb-4">
                      <div className="relative">
                        <img 
                          src={editData.profilePicPreview || '/default-avatar.png'} 
                          alt="Profile preview"
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-teal-200"
                        />
                        <label className={`absolute bottom-0 right-0 bg-primary text-white p-1 rounded-full cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <FiUpload size={12} />
                          <input
                            type="file"
                            name="profilePic"
                            onChange={handleEditChange}
                            className="hidden"
                            accept="image/*"
                            disabled={isSubmitting}
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-secondary">Click camera to change photo</p>
                    </div>

                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={editData.name}
                        onChange={handleEditChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        placeholder="Email Address"
                        value={editData.email}
                        onChange={handleEditChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        name="currentPassword"
                        placeholder="Current Password (required for changes)"
                        value={editData.currentPassword}
                        onChange={handleEditChange}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={isSubmitting}
                      >
                        {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>

                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        name="newPassword"
                        placeholder="New Password (optional)"
                        value={editData.newPassword}
                        onChange={handleEditChange}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isSubmitting}
                      >
                        {showNewPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>

                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmNewPassword"
                        placeholder="Confirm New Password"
                        value={editData.confirmNewPassword}
                        onChange={handleEditChange}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-secondary hover:bg-gray-50 transition disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 flex items-center"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && <FiLoader className="animate-spin mr-2" />}
                      Update Profile
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfile;