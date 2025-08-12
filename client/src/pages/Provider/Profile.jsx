import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ProviderProfile = () => {
  const { token, user, API, showToast, logoutUser } = useAuth();
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
    kycStatus: 'pending'
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
        setProfileData(data.provider);
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

  // Update basic profile info
  const updateBasicProfile = async () => {
    try {
      const response = await fetch(`${API}/provider/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          dateOfBirth: profileData.dateOfBirth
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setProfileData(prev => ({ ...prev, ...data.provider }));
      setEditMode(prev => ({ ...prev, basic: false }));
      showToast('Profile updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Update professional info
  const updateProfessionalInfo = async () => {
    try {
      const response = await fetch(`${API}/provider/profile/professional`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          services: profileData.services,
          experience: profileData.experience,
          serviceArea: profileData.serviceArea
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update professional info');
      }

      const data = await response.json();
      setProfileData(prev => ({ ...prev, ...data.provider }));
      setEditMode(prev => ({ ...prev, professional: false }));
      showToast('Professional info updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Update address
  const updateAddress = async () => {
    try {
      const response = await fetch(`${API}/provider/profile/address`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData.address)
      });

      if (!response.ok) {
        throw new Error('Failed to update address');
      }

      const data = await response.json();
      setProfileData(prev => ({ ...prev, address: data.provider.address }));
      setEditMode(prev => ({ ...prev, address: false }));
      showToast('Address updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Update bank details
  const updateBankDetails = async () => {
    try {
      const formData = new FormData();
      formData.append('accountNo', profileData.bankDetails.accountNo);
      formData.append('ifsc', profileData.bankDetails.ifsc);
      if (fileUploads.passbookImage) {
        formData.append('passbookImage', fileUploads.passbookImage);
      }

      const response = await fetch(`${API}/provider/profile/bank`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update bank details');
      }

      const data = await response.json();
      setProfileData(prev => ({
        ...prev,
        bankDetails: data.provider.bankDetails
      }));
      setFileUploads(prev => ({ ...prev, passbookImage: null }));
      setEditMode(prev => ({ ...prev, bank: false }));
      showToast('Bank details updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Update profile picture
  const updateProfilePicture = async () => {
    try {
      if (!fileUploads.profilePic) {
        throw new Error('Please select a profile picture');
      }

      const formData = new FormData();
      formData.append('profilePic', fileUploads.profilePic);

      const response = await fetch(`${API}/provider/profile/picture`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update profile picture');
      }

      const data = await response.json();
      setProfileData(prev => ({
        ...prev,
        profilePicUrl: data.profilePicUrl
      }));
      setFileUploads(prev => ({ ...prev, profilePic: null }));
      showToast('Profile picture updated successfully');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Update resume
  const updateResume = async () => {
    try {
      if (!fileUploads.resume) {
        throw new Error('Please select a resume file');
      }

      const formData = new FormData();
      formData.append('resume', fileUploads.resume);

      const response = await fetch(`${API}/provider/profile/resume`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update resume');
      }

      const data = await response.json();
      setProfileData(prev => ({
        ...prev,
        resume: data.resumeUrl
      }));
      setFileUploads(prev => ({ ...prev, resume: null }));
      showToast('Resume updated successfully');
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
          throw new Error('Failed to delete account');
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
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center">
            <div className="relative mb-4 md:mb-0 md:mr-6">
              <img 
                src={`${API}/${profileData.profilePicUrl || 'default-provider.jpg'}`} 
                alt="Profile" 
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow"
              />
              <div className="mt-4">
                <input 
                  type="file" 
                  id="profilePic" 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, 'profilePic')} 
                  accept="image/*"
                />
                <label 
                  htmlFor="profilePic" 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer"
                >
                  Change Photo
                </label>
                {fileUploads.profilePic && (
                  <button 
                    onClick={updateProfilePicture}
                    className="ml-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
                  >
                    Upload
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800">{profileData.name}</h1>
              <p className="text-gray-600 mb-2">{profileData.email}</p>
              <p className="text-gray-600 mb-2">{profileData.phone}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  profileData.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {profileData.approved ? 'Approved' : 'Pending Approval'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  profileData.kycStatus === 'approved' ? 'bg-green-100 text-green-800' : 
                  profileData.kycStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  KYC: {profileData.kycStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
              {!editMode.basic ? (
                <button 
                  onClick={() => setEditMode({...editMode, basic: true})}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button 
                    onClick={updateBasicProfile}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditMode({...editMode, basic: false})}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                {editMode.basic ? (
                  <input
                    type="text"
                    name="name"
                    value={profileData.name}
                    onChange={(e) => handleChange(e)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{profileData.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                {editMode.basic ? (
                  <input
                    type="text"
                    name="phone"
                    value={profileData.phone}
                    onChange={(e) => handleChange(e)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                {editMode.basic ? (
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleChange(e)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">
                    {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Professional Information</h2>
              {!editMode.professional ? (
                <button 
                  onClick={() => setEditMode({...editMode, professional: true})}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button 
                    onClick={updateProfessionalInfo}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditMode({...editMode, professional: false})}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Services</label>
                {editMode.professional ? (
                  <select
                    name="services"
                    value={profileData.services}
                    onChange={(e) => handleChange(e)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Service</option>
                    <option value="Electrical">Electrical</option>
                    <option value="AC">AC</option>
                    <option value="Appliance Repair">Appliance Repair</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.services || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Experience (years)</label>
                {editMode.professional ? (
                  <input
                    type="number"
                    name="experience"
                    value={profileData.experience || ''}
                    onChange={(e) => handleChange(e)}
                    min="0"
                    max="40"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.experience || '0'} years</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Service Area</label>
                {editMode.professional ? (
                  <input
                    type="text"
                    name="serviceArea"
                    value={profileData.serviceArea || ''}
                    onChange={(e) => handleChange(e)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.serviceArea || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Resume</label>
                <div className="mt-2 flex items-center">
                  {profileData.resume ? (
                    <a 
                      href={`${API}/${profileData.resume}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline mr-4"
                    >
                      View Resume
                    </a>
                  ) : (
                    <span className="text-gray-500 mr-4">No resume uploaded</span>
                  )}
                  <input 
                    type="file" 
                    id="resume" 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, 'resume')} 
                    accept=".pdf,.doc,.docx"
                  />
                  <label 
                    htmlFor="resume" 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md cursor-pointer text-sm"
                  >
                    Change
                  </label>
                  {fileUploads.resume && (
                    <button 
                      onClick={updateResume}
                      className="ml-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Upload
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Address Information</h2>
              {!editMode.address ? (
                <button 
                  onClick={() => setEditMode({...editMode, address: true})}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button 
                    onClick={updateAddress}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditMode({...editMode, address: false})}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Street</label>
                {editMode.address ? (
                  <input
                    type="text"
                    name="street"
                    value={profileData.address.street || ''}
                    onChange={(e) => handleChange(e, 'address')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.address.street || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                {editMode.address ? (
                  <input
                    type="text"
                    name="city"
                    value={profileData.address.city || ''}
                    onChange={(e) => handleChange(e, 'address')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.address.city || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                {editMode.address ? (
                  <input
                    type="text"
                    name="state"
                    value={profileData.address.state || ''}
                    onChange={(e) => handleChange(e, 'address')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.address.state || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                {editMode.address ? (
                  <input
                    type="text"
                    name="postalCode"
                    value={profileData.address.postalCode || ''}
                    onChange={(e) => handleChange(e, 'address')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.address.postalCode || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                {editMode.address ? (
                  <input
                    type="text"
                    name="country"
                    value={profileData.address.country || ''}
                    onChange={(e) => handleChange(e, 'address')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.address.country || 'Not specified'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Bank Details</h2>
              {!editMode.bank ? (
                <button 
                  onClick={() => setEditMode({...editMode, bank: true})}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button 
                    onClick={updateBankDetails}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditMode({...editMode, bank: false})}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Number</label>
                {editMode.bank ? (
                  <input
                    type="text"
                    name="accountNo"
                    value={profileData.bankDetails.accountNo || ''}
                    onChange={(e) => handleChange(e, 'bank')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">
                    {profileData.bankDetails.accountNo ? '••••••••' + profileData.bankDetails.accountNo.slice(-4) : 'Not specified'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
                {editMode.bank ? (
                  <input
                    type="text"
                    name="ifsc"
                    value={profileData.bankDetails.ifsc || ''}
                    onChange={(e) => handleChange(e, 'bank')}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{profileData.bankDetails.ifsc || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passbook Image</label>
                <div className="mt-2 flex items-center">
                  {profileData.bankDetails.passbookImage ? (
                    <a 
                      href={`${API}/${profileData.bankDetails.passbookImage}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline mr-4"
                    >
                      View Passbook
                    </a>
                  ) : (
                    <span className="text-gray-500 mr-4">No passbook uploaded</span>
                  )}
                  {editMode.bank && (
                    <>
                      <input 
                        type="file" 
                        id="passbookImage" 
                        className="hidden" 
                        onChange={(e) => handleFileChange(e, 'passbookImage')} 
                        accept="image/*"
                      />
                      <label 
                        htmlFor="passbookImage" 
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md cursor-pointer text-sm"
                      >
                        Change
                      </label>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Verification Status</label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    profileData.bankDetails.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {profileData.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={deleteAccount}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderProfile;