import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ProviderProfile = () => {
  const { token, API, showToast, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [documentModal, setDocumentModal] = useState({ isOpen: false, type: null, url: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, confirmed: false });

  // Profile Data State
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    role: '',
    services: '',
    experience: '',
    serviceArea: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India'
    },
    bankDetails: {
      accountNo: '',
      ifsc: '',
      bankName: '',
      accountName: '',
      passbookImage: '',
      passbookImagePublicId: '',
      verified: false
    },
    wallet: {
      availableBalance: 0,
      totalWithdrawn: 0,
      lastUpdated: null
    },
    kycStatus: 'pending',
    rejectionReason: '',
    profilePicUrl: '',
    profilePicPublicId: '',
    resume: '',
    resumePublicId: '',
    approved: false,
    testPassed: false,
    completedBookings: 0,
    canceledBookings: 0,
    feedbacks: [],
    blockedTill: null,
    isDeleted: false,
    isActive: true,
    profileComplete: false,
    registrationDate: null,
    age: 0,
    updatedAt: null,
    createdAt: null,
    averageRating: 0,
    ratingCount: 0
  });

  // UI State
  const [editMode, setEditMode] = useState({
    basic: false,
    professional: false,
    address: false,
    bank: false
  });

  const [fileUploads, setFileUploads] = useState({
    profilePic: null,
    resume: null,
    passbookImage: null
  });

  // Fetch provider profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API}/provider/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        if (data.success) {
          setProfileData({
            ...data.provider,
            address: data.provider.address || {
              street: '',
              city: '',
              state: '',
              postalCode: '',
              country: 'India'
            },
            bankDetails: data.provider.bankDetails || {
              accountNo: '',
              ifsc: '',
              bankName: '',
              accountName: '',
              passbookImage: '',
              passbookImagePublicId: '',
              verified: false
            },
            feedbacks: data.provider.feedbacks || []
          });
        } else {
          showToast(data.message, 'error');
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    fetchProfile();
  }, [token, API, showToast]);

  // Handle input changes
  const handleChange = (e, section) => {
    const { name, value } = e.target;

    if (section === 'address') {
      setProfileData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [name]: value
        }
      }));
    } else if (section === 'bank') {
      setProfileData(prev => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          [name]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle file uploads
  const handleFileChange = (e, field) => {
    setFileUploads(prev => ({
      ...prev,
      [field]: e.target.files[0]
    }));
  };

  // Unified profile update function
  const updateProfile = async (updateType) => {
    try {
      const formData = new FormData();

      formData.append('updateType', updateType);

      switch (updateType) {
        case 'basic':
          formData.append('name', profileData.name);
          formData.append('phone', profileData.phone);
          formData.append('dateOfBirth', profileData.dateOfBirth);
          if (fileUploads.profilePic) {
            formData.append('profilePic', fileUploads.profilePic);
          }
          break;

        case 'professional':
          formData.append('services', profileData.services);
          formData.append('experience', profileData.experience);
          formData.append('serviceArea', profileData.serviceArea);
          if (fileUploads.resume) {
            formData.append('resume', fileUploads.resume);
          }
          break;

        case 'address':
          formData.append('street', profileData.address.street);
          formData.append('city', profileData.address.city);
          formData.append('state', profileData.address.state);
          formData.append('postalCode', profileData.address.postalCode);
          formData.append('country', profileData.address.country);
          break;

        case 'bank':
          formData.append('accountNo', profileData.bankDetails.accountNo);
          formData.append('ifsc', profileData.bankDetails.ifsc);
          formData.append('bankName', profileData.bankDetails.bankName);
          formData.append('accountName', profileData.bankDetails.accountName);
          if (fileUploads.passbookImage) {
            formData.append('passbookImage', fileUploads.passbookImage);
          }
          break;

        case 'profilePic':
          if (!fileUploads.profilePic) {
            throw new Error('Please select a profile picture');
          }
          formData.append('profilePic', fileUploads.profilePic);
          break;

        case 'resume':
          if (!fileUploads.resume) {
            throw new Error('Please select a resume file');
          }
          formData.append('resume', fileUploads.resume);
          break;
      }

      const response = await fetch(`${API}/provider/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      if (data.success) {
        setProfileData(prev => ({
          ...prev,
          ...data.provider,
          address: data.provider.address || prev.address,
          bankDetails: data.provider.bankDetails || prev.bankDetails
        }));

        setFileUploads({ profilePic: null, resume: null, passbookImage: null });
        setEditMode({ basic: false, professional: false, address: false, bank: false });

        showToast(data.message || 'Profile updated successfully');
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // View document function
  const viewDocument = async (type) => {
    try {
      const response = await fetch(`${API}/provider/document/${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to view ${type}`);
      }

      const data = await response.json();
      if (data.success) {
        setDocumentModal({
          isOpen: true,
          type: type,
          url: data.fileUrl
        });
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Close document modal
  const closeDocumentModal = () => {
    setDocumentModal({ isOpen: false, type: null, url: null });
  };

  // Open delete confirmation modal
  const openDeleteModal = () => {
    setDeleteModal({ isOpen: true, confirmed: false });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, confirmed: false });
  };

  // Handle delete confirmation checkbox
  const handleDeleteConfirmation = (e) => {
    setDeleteModal(prev => ({ ...prev, confirmed: e.target.checked }));
  };

  // Delete account
  const deleteAccount = async () => {
    if (!deleteModal.confirmed) {
      showToast('Please confirm that you understand the consequences', 'error');
      return;
    }

    try {
      const response = await fetch(`${API}/provider/profile`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }

      const data = await response.json();
      if (data.success) {
        showToast('Account deleted successfully');
        closeDeleteModal();
        logoutUser();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    const fields = [
      profileData.name,
      profileData.phone,
      profileData.dateOfBirth,
      profileData.services,
      profileData.experience,
      profileData.serviceArea,
      profileData.address.street,
      profileData.address.city,
      profileData.address.state,
      profileData.address.postalCode,
      profileData.bankDetails.accountNo,
      profileData.bankDetails.ifsc,
      profileData.profilePicUrl,
      profileData.resume,
      profileData.bankDetails.passbookImage
    ];

    const completedFields = fields.filter(field => field && field !== '').length;
    return Math.round((completedFields / fields.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Service Provider Profile</h1>
          <p className="mt-2 text-gray-600">Manage your professional information and documents</p>
        </div>

        {/* Profile Completion Banner */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 border border-gray-100">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Profile Completion</h3>
              <span className="text-2xl font-bold text-teal-600">{calculateProfileCompletion()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${calculateProfileCompletion()}%` }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Complete your profile to increase your chances of getting more bookings
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 border border-gray-100">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap space-x-8 px-6">
              {[
                { id: 'overview', name: 'Overview', icon: '👤' },
                { id: 'documents', name: 'Documents', icon: '📄' },
                { id: 'profile', name: 'Profile Details', icon: '⚙️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <span className="mr-2 text-lg">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Statistics */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Service Statistics</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 bg-teal-50 rounded-lg">
                    <div className="text-3xl font-bold text-teal-600">{profileData.completedBookings}</div>
                    <div className="text-sm text-gray-600 mt-1">Completed Bookings</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600">{profileData.canceledBookings}</div>
                    <div className="text-sm text-gray-600 mt-1">Canceled Bookings</div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Test Status:</span>
                      <span className={`text-sm font-medium ${profileData.testPassed ? 'text-green-600' : 'text-yellow-500'}`}>
                        {profileData.testPassed ? 'Passed' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Account Status:</span>
                      <span className={`text-sm font-medium ${profileData.isActive ? 'text-green-600' : 'text-red-500'}`}>
                        {profileData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Approval Status:</span>
                      <span className={`text-sm font-medium ${profileData.approved ? 'text-green-600' : 'text-yellow-500'}`}>
                        {profileData.approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">KYC Status:</span>
                      <span className={`text-sm font-medium ${profileData.kycStatus === 'approved' ? 'text-green-600' :
                        profileData.kycStatus === 'rejected' ? 'text-red-600' : 'text-yellow-500'
                        }`}>
                        {profileData.kycStatus.charAt(0).toUpperCase() + profileData.kycStatus.slice(1)}
                      </span>
                    </div>
                  </div>
                  {profileData.blockedTill && (
                    <div className="flex justify-between items-center mt-4 p-3 bg-red-50 rounded-md">
                      <span className="text-sm text-red-700">Blocked Until:</span>
                      <span className="text-sm font-medium text-red-700">
                        {new Date(profileData.blockedTill).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Account Information</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600">Registration Date</span>
                    <span className="text-sm font-medium text-gray-900">
                      {profileData.registrationDate ?
                        new Date(profileData.registrationDate).toLocaleDateString() :
                        'Not available'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600">Account Age</span>
                    <span className="text-sm font-medium text-gray-900">
                      {profileData.age ? `${profileData.age} years` : 'Not available'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600">Last Updated</span>
                    <span className="text-sm font-medium text-gray-900">
                      {profileData.updatedAt ?
                        new Date(profileData.updatedAt).toLocaleDateString() :
                        'Not available'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-600">Member Since</span>
                    <span className="text-sm font-medium text-gray-900">
                      {profileData.createdAt ?
                        new Date(profileData.createdAt).toLocaleDateString() :
                        'Not available'}
                    </span>
                  </div>
                </div>

                {profileData.kycStatus === 'rejected' && profileData.rejectionReason && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-800">KYC Rejection Reason</h4>
                    <p className="mt-1 text-sm text-red-700">{profileData.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 md:col-span-2">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Customer Rating</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div className="text-center mb-6 md:mb-0">
                    <div className="text-5xl font-bold text-teal-600">{profileData.averageRating || 0}</div>
                    <div className="flex justify-center mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-6 h-6 ${star <= (profileData.averageRating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{profileData.ratingCount || 0} reviews</p>
                  </div>
                  
                  <div className="bg-teal-50 p-4 rounded-lg w-full md:w-1/2">
                    <h4 className="text-sm font-medium text-teal-800 mb-2">Rating Distribution</h4>
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <div key={rating} className="flex items-center">
                          <span className="text-xs text-gray-600 w-4">{rating}</span>
                          <div className="w-full bg-gray-200 rounded-full h-2 mx-2">
                            <div 
                              className="bg-yellow-400 h-2 rounded-full" 
                              style={{ width: `${(rating / 5) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600">{(rating / 5 * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Document Center */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Document Center</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Picture */}
                  <div className="border border-gray-200 rounded-xl p-5 transition-all hover:shadow-md">
                    <div className="text-center">
                      <div className="mb-4 relative">
                        <img
                          src={profileData.profilePicUrl || '/default-provider.jpg'}
                          alt="Profile"
                          className="w-24 h-24 rounded-full mx-auto border-4 border-teal-100 object-cover shadow-sm"
                          onError={(e) => {
                            e.target.src = '/default-provider.jpg';
                          }}
                        />
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${profileData.profilePicUrl ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {profileData.profilePicUrl ? 'Uploaded' : 'Default'}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Profile Picture</h3>
                      <div className="space-y-3">
                        <div className="flex flex-col space-y-2">
                          <label
                            htmlFor="profilePicUpload"
                            className="cursor-pointer inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Update Photo
                          </label>
                          <input
                            id="profilePicUpload"
                            type="file"
                            onChange={(e) => handleFileChange(e, 'profilePic')}
                            accept="image/*"
                            className="hidden"
                          />
                          {fileUploads.profilePic && (
                            <button
                              onClick={() => updateProfile('profilePic')}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-sm font-medium text-white transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Photo
                            </button>
                          )}
                          {profileData.profilePicUrl && (
                            <button
                              onClick={() => viewDocument('profile')}
                              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resume */}
                  <div className="border border-gray-200 rounded-xl p-5 transition-all hover:shadow-md">
                    <div className="text-center">
                      <div className="mb-4">
                        <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center shadow-sm">
                          <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${profileData.resume ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {profileData.resume ? 'Uploaded' : 'Not Uploaded'}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Resume</h3>
                      <div className="space-y-3">
                        <div className="flex flex-col space-y-2">
                          {profileData.resume && (
                            <button
                              onClick={() => viewDocument('resume')}
                              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm font-medium transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View Resume
                            </button>
                          )}
                          <label
                            htmlFor="resumeUpload"
                            className="cursor-pointer inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {profileData.resume ? 'Update Resume' : 'Upload Resume'}
                          </label>
                          <input
                            id="resumeUpload"
                            type="file"
                            onChange={(e) => handleFileChange(e, 'resume')}
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                          />
                          {fileUploads.resume && (
                            <button
                              onClick={() => updateProfile('resume')}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-sm font-medium text-white transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Resume
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Passbook */}
                  <div className="border border-gray-200 rounded-xl p-5 transition-all hover:shadow-md">
                    <div className="text-center">
                      <div className="mb-4">
                        <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center shadow-sm">
                          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div className="mt-2 space-y-1">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${profileData.bankDetails.passbookImage ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {profileData.bankDetails.passbookImage ? 'Uploaded' : 'Not Uploaded'}
                          </span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${profileData.bankDetails.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {profileData.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Bank Passbook</h3>
                      <div className="space-y-3">
                        <div className="flex flex-col space-y-2">
                          {profileData.bankDetails.passbookImage && (
                            <button
                              onClick={() => viewDocument('passbook')}
                              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm font-medium transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Passbook
                            </button>
                          )}
                          <label
                            htmlFor="passbookUpload"
                            className="cursor-pointer inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {profileData.bankDetails.passbookImage ? 'Update Passbook' : 'Upload Passbook'}
                          </label>
                          <input
                            id="passbookUpload"
                            type="file"
                            onChange={(e) => handleFileChange(e, 'passbookImage')}
                            accept="image/*"
                            className="hidden"
                          />
                          {fileUploads.passbookImage && (
                            <button
                              onClick={() => updateProfile('bank')}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md text-sm font-medium text-white transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Passbook
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Guidelines */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Document Guidelines
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Profile picture should be clear and professional</li>
                    <li>• Resume should be in PDF, DOC, or DOCX format</li>
                    <li>• Bank passbook image should clearly show account details</li>
                    <li>• All documents will be verified by our team</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Profile Overview Card */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 text-center">
                <h2 className="text-xl font-semibold text-white">Profile Overview</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <img
                      src={profileData.profilePicUrl || '/default-provider.jpg'}
                      alt="Profile"
                      className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
                      onError={(e) => {
                        e.target.src = '/default-provider.jpg';
                      }}
                    />
                    <div className="absolute bottom-0 right-0 bg-teal-500 rounded-full p-1">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{profileData.name}</h3>
                  <p className="text-teal-600">{profileData.email}</p>
                  <p className="text-gray-600 mt-1">{profileData.phone}</p>
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">ACCOUNT STATUS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <span className="text-sm text-gray-600">Approval Status:</span>
                      <span className={`text-sm font-medium ${profileData.approved ? 'text-green-600' : 'text-yellow-500'}`}>
                        {profileData.approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <span className="text-sm text-gray-600">KYC Status:</span>
                      <span className={`text-sm font-medium ${profileData.kycStatus === 'approved' ? 'text-green-600' :
                        profileData.kycStatus === 'rejected' ? 'text-red-600' : 'text-yellow-500'
                        }`}>
                        {profileData.kycStatus.charAt(0).toUpperCase() + profileData.kycStatus.slice(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <span className="text-sm text-gray-600">Profile Completion:</span>
                      <span className={`text-sm font-medium ${calculateProfileCompletion() === 100 ? 'text-green-600' : 'text-yellow-500'}`}>
                        {calculateProfileCompletion()}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <span className="text-sm text-gray-600">Bank Verification:</span>
                      <span className={`text-sm font-medium ${profileData.bankDetails.verified ? 'text-green-600' : 'text-yellow-500'}`}>
                        {profileData.bankDetails.verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Basic Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, basic: !editMode.basic })}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${editMode.basic ? 'bg-white text-teal-600' : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                >
                  {editMode.basic ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              </div>

              <div className="p-6">
                {editMode.basic ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('basic'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          name="name"
                          value={profileData.name}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={profileData.email}
                          readOnly
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={profileData.phone}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, basic: false })}
                        className="px-6 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.name}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.email}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.phone || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : 'Not provided'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Professional Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${editMode.professional ? 'bg-white text-teal-600' : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                >
                  {editMode.professional ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              </div>

              <div className="p-6">
                {editMode.professional ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
                        <select
                          name="services"
                          value={profileData.services}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        >
                          <option value="">Select Service</option>
                          <option value="Electrical">Electrical</option>
                          <option value="AC">AC</option>
                          <option value="Appliance Repair">Appliance Repair</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Experience (years)</label>
                        <input
                          type="number"
                          name="experience"
                          value={profileData.experience || ''}
                          onChange={(e) => handleChange(e)}
                          min="0"
                          max="40"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Area</label>
                        <input
                          type="text"
                          name="serviceArea"
                          value={profileData.serviceArea || ''}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, professional: false })}
                        className="px-6 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.services || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {profileData.experience ? `${profileData.experience} years` : 'Not provided'}
                      </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Service Area</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.serviceArea || 'Not provided'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Address Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${editMode.address ? 'bg-white text-teal-600' : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                >
                  {editMode.address ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              </div>

              <div className="p-6">
                {editMode.address ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Street</label>
                        <input
                          type="text"
                          name="street"
                          value={profileData.address.street}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileData.address.city}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                        <input
                          type="text"
                          name="state"
                          value={profileData.address.state}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={profileData.address.postalCode}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                        <input
                          type="text"
                          name="country"
                          value={profileData.address.country}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, address: false })}
                        className="px-6 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Street</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.address.street || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">City</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.address.city || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">State</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.address.state || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Postal Code</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.address.postalCode || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Country</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.address.country || 'Not provided'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bank Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Bank Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, bank: !editMode.bank })}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${editMode.bank ? 'bg-white text-teal-600' : 'bg-white/20 text-white hover:bg-white/30'
                    } transition-colors`}
                >
                  {editMode.bank ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              </div>

              <div className="p-6">
                {editMode.bank ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('bank'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                        <input
                          type="text"
                          name="accountNo"
                          value={profileData.bankDetails.accountNo}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                        <input
                          type="text"
                          name="ifsc"
                          value={profileData.bankDetails.ifsc}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                        <input
                          type="text"
                          name="bankName"
                          value={profileData.bankDetails.bankName}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                        <input
                          type="text"
                          name="accountName"
                          value={profileData.bankDetails.accountName}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, bank: false })}
                        className="px-6 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Number</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {profileData.bankDetails.accountNo ?
                          `****${profileData.bankDetails.accountNo.slice(-4)}` :
                          'Not provided'}
                      </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">IFSC Code</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.bankDetails.ifsc || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Holder Name</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.bankDetails.bankName || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Name</h3>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profileData.bankDetails.accountName || 'Not provided'}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Verification Status</h3>
                      <p className={`mt-1 text-sm font-medium ${profileData.bankDetails.verified ? 'text-green-600' : 'text-yellow-500'
                        }`}>
                        {profileData.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Account Actions</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Account
                    </h4>
                    <p className="text-sm text-red-700 mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                      onClick={openDeleteModal}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Modal */}
        {documentModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden flex flex-col">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                  {documentModal.type} Document
                </h3>
                <button
                  onClick={closeDocumentModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {documentModal.type === 'profile' ? (
                  <div className="flex justify-center">
                    <img
                      src={documentModal.url}
                      alt="Profile"
                      className="max-w-full max-h-96 object-contain"
                      onError={(e) => {
                        e.target.src = '/default-provider.jpg';
                        showToast('Failed to load profile image', 'error');
                      }}
                    />
                  </div>
                ) : documentModal.type === 'resume' ? (
                  <iframe
                    src={documentModal.url}
                    className="w-full h-96"
                    title="Resume"
                    onError={(e) => {
                      showToast('Failed to load resume document', 'error');
                    }}
                  />
                ) : (
                  <div className="flex justify-center">
                    <img
                      src={documentModal.url}
                      alt="Passbook"
                      className="max-w-full max-h-96 object-contain"
                      onError={(e) => {
                        showToast('Failed to load passbook image', 'error');
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={closeDocumentModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Delete Account</h3>
                    <p className="text-sm text-gray-500">Are you sure you want to delete your account?</p>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Warning: This action cannot be undone</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• All your data will be permanently deleted</li>
                    <li>• Your profile will be removed from the platform</li>
                    <li>• Any pending bookings will be canceled</li>
                    <li>• You will need to register again to use our services</li>
                  </ul>
                </div>

                <div className="flex items-start mb-4">
                  <div className="flex items-center h-5">
                    <input
                      id="confirmation"
                      type="checkbox"
                      checked={deleteModal.confirmed}
                      onChange={handleDeleteConfirmation}
                      className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="confirmation" className="font-medium text-gray-700">
                      I understand that this action is irreversible
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeDeleteModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={!deleteModal.confirmed}
                    className={`px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${deleteModal.confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-400 cursor-not-allowed'} transition-colors`}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderProfile;