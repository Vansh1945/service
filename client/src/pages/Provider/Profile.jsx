import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ProviderProfile = () => {
  const { token, API, showToast, logoutUser } = useAuth();
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
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
      passbookImage: '',
      verified: false
    },
    profilePicUrl: '',
    resume: '',
    approved: false,
    kycStatus: 'pending',
    profileComplete: false,
    completedBookings: 0,
    canceledBookings: 0,
    wallet: 0,
    testPassed: false,
    isActive: true,
    blockedTill: null,
    registrationDate: null,
    age: 0,
    updatedAt: null,
    createdAt: null,
    feedbacks: [],
    earningsHistory: [],
    rejectionReason: ''
  });
  
  const [loading, setLoading] = useState(true);
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
  const [isUploading, setIsUploading] = useState(false);

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
        setProfileData({
          ...data.provider,
          // Ensure all fields have default values if not provided
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
            passbookImage: '',
            verified: false
          },
          feedbacks: data.provider.feedbacks || [],
          earningsHistory: data.provider.earningsHistory || []
        });
        setLoading(false);
      } catch (error) {
        showToast(error.message, 'error');
        setLoading(false);
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
      setIsUploading(true);
      const formData = new FormData();

      // Add update type
      formData.append('updateType', updateType);

      // Add data based on update type
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
      setProfileData(prev => ({
        ...prev,
        ...data.provider,
        address: data.provider.address || prev.address,
        bankDetails: data.provider.bankDetails || prev.bankDetails
      }));

      // Clear file uploads and edit modes
      setFileUploads({ profilePic: null, resume: null, passbookImage: null });
      setEditMode({ basic: false, professional: false, address: false, bank: false });

      showToast(data.message || 'Profile updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsUploading(false);
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

      // Create blob URL and open in new tab
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up the URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
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

        showToast('Account deleted successfully');
        logoutUser();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-900">Service Provider Profile</h1>
          <p className="mt-2 text-gray-600">Manage your professional information and documents</p>
        </div>

        {/* Service Statistics */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="bg-blue-900 px-6 py-4">
            <h2 className="text-xl font-semibold text-white">Service Statistics</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{profileData.completedBookings}</div>
                <div className="text-sm text-gray-500">Completed Bookings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500">{profileData.canceledBookings}</div>
                <div className="text-sm text-gray-500">Canceled Bookings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">₹{profileData.wallet}</div>
                <div className="text-sm text-gray-500">Wallet Balance</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Test Status:</span>
                <span className={`text-sm font-medium ${profileData.testPassed ? 'text-green-600' : 'text-yellow-500'}`}>
                  {profileData.testPassed ? 'Passed' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">Account Status:</span>
                <span className={`text-sm font-medium ${profileData.isActive ? 'text-green-600' : 'text-red-500'}`}>
                  {profileData.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {profileData.blockedTill && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-600">Blocked Until:</span>
                  <span className="text-sm font-medium text-red-600">
                    {new Date(profileData.blockedTill).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="bg-blue-900 px-6 py-4">
            <h2 className="text-xl font-semibold text-white">Account Information</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Registration Date</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {profileData.registrationDate ? 
                    new Date(profileData.registrationDate).toLocaleDateString() : 
                    'Not available'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Account Age</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {profileData.age ? `${profileData.age} years` : 'Not available'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {profileData.updatedAt ? 
                    new Date(profileData.updatedAt).toLocaleDateString() : 
                    'Not available'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Member Since</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {profileData.createdAt ? 
                    new Date(profileData.createdAt).toLocaleDateString() : 
                    'Not available'}
                </p>
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

        {/* Recent Feedbacks */}
        {profileData.feedbacks && profileData.feedbacks.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="bg-blue-900 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Recent Customer Feedbacks</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {profileData.feedbacks.map((feedback, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-4 h-4 ${i < feedback.rating ? 'fill-current' : 'text-gray-300'}`}
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="ml-2 text-sm text-gray-600">
                            by {feedback.customer?.name || 'Anonymous'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{feedback.comment}</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Earnings */}
        {profileData.earningsHistory && profileData.earningsHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="bg-blue-900 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Recent Earnings</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {profileData.earningsHistory.map((earning, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{earning.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(earning.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${earning.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {earning.amount > 0 ? '+' : ''}₹{Math.abs(earning.amount)}
                      </p>
                      <p className="text-xs text-gray-500">{earning.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4 text-center">
                <h2 className="text-xl font-semibold text-white">Profile Overview</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <img
                      src={`${API}/uploads/${profileData.profilePicUrl || 'default-provider.jpg'}`}
                      alt="Profile"
                      className="w-32 h-32 rounded-full border-4 border-blue-200 object-cover"
                    />
                    <label
                      htmlFor="profilePic"
                      className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </label>
                    <input
                      id="profilePic"
                      type="file"
                      onChange={(e) => handleFileChange(e, 'profilePic')}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{profileData.name}</h3>
                  <p className="text-blue-600">{profileData.email}</p>
                  <p className="text-gray-600 mt-1">{profileData.phone}</p>

                  {fileUploads.profilePic && (
                    <button
                      onClick={() => updateProfile('profilePic')}
                      disabled={isUploading}
                      className={`mt-4 px-4 py-2 rounded-md text-sm font-medium text-white ${isUploading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {isUploading ? 'Uploading...' : 'Save Photo'}
                    </button>
                  )}
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">ACCOUNT STATUS</h4>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Approval Status:</span>
                    <span className={`text-sm font-medium ${profileData.approved ? 'text-green-600' : 'text-yellow-500'}`}>
                      {profileData.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">KYC Status:</span>
                    <span className={`text-sm font-medium ${
                      profileData.kycStatus === 'approved' ? 'text-green-600' : 
                      profileData.kycStatus === 'rejected' ? 'text-red-600' : 'text-yellow-500'
                    }`}>
                      {profileData.kycStatus.charAt(0).toUpperCase() + profileData.kycStatus.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Profile Completion:</span>
                    <span className={`text-sm font-medium ${profileData.profileComplete ? 'text-green-600' : 'text-yellow-500'}`}>
                      {profileData.profileComplete ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Bank Verification:</span>
                    <span className={`text-sm font-medium ${profileData.bankDetails.verified ? 'text-green-600' : 'text-yellow-500'}`}>
                      {profileData.bankDetails.verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">DOCUMENTS</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Profile Picture:</span>
                      {profileData.profilePicUrl ? (
                        <span className="text-sm text-green-600 font-medium">Uploaded</span>
                      ) : (
                        <span className="text-sm text-gray-500">Default</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Resume:</span>
                      {profileData.resume ? (
                        <button
                          onClick={() => viewDocument('resume')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">Not uploaded</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Passbook:</span>
                      {profileData.bankDetails.passbookImage ? (
                        <button
                          onClick={() => viewDocument('passbook')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">Not uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Basic Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, basic: !editMode.basic })}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    editMode.basic ? 'bg-white text-blue-600' : 'bg-yellow-400 text-blue-900 hover:bg-yellow-500'
                  }`}
                >
                  {editMode.basic ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="p-6">
                {editMode.basic ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('basic'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          name="name"
                          value={profileData.name}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={profileData.email}
                          readOnly
                          className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={profileData.phone}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          name="dateOfBirth"
                          value={profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, basic: false })}
                        className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          isUploading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      >
                        {isUploading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.name}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Email</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.email}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.phone || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Date of Birth</h3>
                      <p className="mt-1 text-sm text-gray-900">
                        {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : 'Not provided'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Professional Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    editMode.professional ? 'bg-white text-blue-600' : 'bg-yellow-400 text-blue-900 hover:bg-yellow-500'
                  }`}
                >
                  {editMode.professional ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="p-6">
                {editMode.professional ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                        <select
                          name="services"
                          value={profileData.services}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Service</option>
                          <option value="Electrical">Electrical</option>
                          <option value="AC">AC</option>
                          <option value="Appliance Repair">Appliance Repair</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
                        <input
                          type="number"
                          name="experience"
                          value={profileData.experience || ''}
                          onChange={(e) => handleChange(e)}
                          min="0"
                          max="40"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Service Area</label>
                        <input
                          type="text"
                          name="serviceArea"
                          value={profileData.serviceArea || ''}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Resume</label>
                        <div className="flex items-center">
                          <input
                            type="file"
                            id="resume"
                            onChange={(e) => handleFileChange(e, 'resume')}
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                          />
                          <label
                            htmlFor="resume"
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                          >
                            Choose File
                          </label>
                          <span className="ml-2 text-sm text-gray-500">
                            {fileUploads.resume ? fileUploads.resume.name : 'No file chosen'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, professional: false })}
                        className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          isUploading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      >
                        {isUploading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Service Type</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.services || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Experience</h3>
                      <p className="mt-1 text-sm text-gray-900">
                        {profileData.experience ? `${profileData.experience} years` : 'Not provided'}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">Service Area</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.serviceArea || 'Not provided'}</p>
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">Resume</h3>
                      <div className="mt-1">
                        {profileData.resume ? (
                          <button
                            onClick={() => viewDocument('resume')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Resume
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500">Not uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Address Information</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    editMode.address ? 'bg-white text-blue-600' : 'bg-yellow-400 text-blue-900 hover:bg-yellow-500'
                  }`}
                >
                  {editMode.address ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="p-6">
                {editMode.address ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                        <input
                          type="text"
                          name="street"
                          value={profileData.address.street}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileData.address.city}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          name="state"
                          value={profileData.address.state}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={profileData.address.postalCode}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <input
                          type="text"
                          name="country"
                          value={profileData.address.country}
                          onChange={(e) => handleChange(e, 'address')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, address: false })}
                        className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          isUploading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      >
                        {isUploading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Street</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.address.street || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">City</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.address.city || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">State</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.address.state || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Postal Code</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.address.postalCode || 'Not provided'}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Country</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.address.country || 'Not provided'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Bank Details</h2>
                <button
                  onClick={() => setEditMode({ ...editMode, bank: !editMode.bank })}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    editMode.bank ? 'bg-white text-blue-600' : 'bg-yellow-400 text-blue-900 hover:bg-yellow-500'
                  }`}
                >
                  {editMode.bank ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="p-6">
                {editMode.bank ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('bank'); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                        <input
                          type="text"
                          name="accountNo"
                          value={profileData.bankDetails.accountNo}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          name="ifsc"
                          value={profileData.bankDetails.ifsc}
                          onChange={(e) => handleChange(e, 'bank')}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passbook Image</label>
                        <div className="flex items-center">
                          <input
                            type="file"
                            id="passbookImage"
                            onChange={(e) => handleFileChange(e, 'passbookImage')}
                            accept="image/*"
                            className="hidden"
                          />
                          <label
                            htmlFor="passbookImage"
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                          >
                            Choose File
                          </label>
                          <span className="ml-2 text-sm text-gray-500">
                            {fileUploads.passbookImage ? fileUploads.passbookImage.name : 'No file chosen'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditMode({ ...editMode, bank: false })}
                        className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          isUploading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      >
                        {isUploading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Account Number</h3>
                      <p className="mt-1 text-sm text-gray-900">
                        {profileData.bankDetails.accountNo ? '••••••••' + profileData.bankDetails.accountNo.slice(-4) : 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-500">IFSC Code</h3>
                      <p className="mt-1 text-sm text-gray-900">{profileData.bankDetails.ifsc || 'Not provided'}</p>
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">Passbook Image</h3>
                      <div className="mt-1">
                        {profileData.bankDetails.passbookImage ? (
                          <button
                            onClick={() => viewDocument('passbook')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Passbook
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500">Not uploaded</span>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">Verification Status</h3>
                      <p className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          profileData.bankDetails.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {profileData.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Account Actions</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={logoutUser}
                    className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Logout
                  </button>
                  <button
                    onClick={deleteAccount}
                    className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderProfile;