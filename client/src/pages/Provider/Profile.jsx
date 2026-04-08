import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import { Loader2, AlertCircle, Edit2, X, Check, Upload, Eye, Camera, FileText, CreditCard } from 'lucide-react';
import * as ProviderService from '../../services/ProviderService';

const ProviderProfile = () => {
  const { token, API, showToast, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [documentModal, setDocumentModal] = useState({ isOpen: false, type: null, url: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, confirmed: false });

  // Profile Data State
  const [profileData, setProfileData] = useState({
    name: '', email: '', phone: '', dateOfBirth: '', role: '', services: [],
    experience: '', serviceArea: '',
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
    ratingCount: 0,
    providerId: ''
  });

  const [editMode, setEditMode] = useState({ basic: false, professional: false, address: false, bank: false });
  const [fileUploads, setFileUploads] = useState({ profilePic: null, resume: null, passbookImage: null });
  const [providerServices, setProviderServices] = useState([]);
  const [providerServicesLoading, setProviderServicesLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const serviceMap = providerServices.reduce((acc, s) => { acc[s._id] = s.name; return acc; }, {});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await ProviderService.getProfile();
        const data = response.data;
        if (data.success) {
          setProfileData({
            ...data.provider,
            services: Array.isArray(data.provider.services) ? data.provider.services : [],
            address: data.provider.address || { street: '', city: '', state: '', postalCode: '', country: 'India' },
            bankDetails: data.provider.bankDetails || { accountNo: '', ifsc: '', bankName: '', accountName: '', passbookImage: '', passbookImagePublicId: '', verified: false },
            feedbacks: data.provider.feedbacks || []
          });
        } else {
          showToast(data.message, 'error');
        }
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    const fetchServices = async () => {
      try {
        setProviderServicesLoading(true);
        const response = await fetch(`${API}/system-setting/categories`);
        if (!response.ok) throw new Error('Failed to fetch service categories');
        const data = await response.json();
        if (data.success) setProviderServices(data.data || []);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setProviderServicesLoading(false);
      }
    };

    fetchProfile();
    fetchServices();
  }, [token, API, showToast]);

  const handleServiceChange = (serviceId) => {
    setProfileData(prev => {
      const currentServices = Array.isArray(prev.services) ? prev.services : [];
      if (currentServices.includes(serviceId)) {
        return { ...prev, services: currentServices.filter(s => s !== serviceId) };
      } else if (currentServices.length < 3) {
        return { ...prev, services: [...currentServices, serviceId] };
      } else {
        toast.error('Maximum 3 services allowed');
        return prev;
      }
    });
  };

  const handleChange = (e, section) => {
    const { name, value } = e.target;
    if (section === 'address') {
      setProfileData(prev => ({ ...prev, address: { ...prev.address, [name]: value } }));
    } else if (section === 'bank') {
      setProfileData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [name]: value } }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e, field) => {
    setFileUploads(prev => ({ ...prev, [field]: e.target.files[0] }));
  };

  const updateProfile = async (updateType) => {
    try {
      const formData = new FormData();
      formData.append('updateType', updateType);

      switch (updateType) {
        case 'basic':
          formData.append('name', profileData.name);
          formData.append('phone', profileData.phone);
          formData.append('dateOfBirth', profileData.dateOfBirth);
          if (fileUploads.profilePic) formData.append('profilePic', fileUploads.profilePic);
          break;
        case 'professional':
          formData.append('services', JSON.stringify(profileData.services));
          formData.append('experience', profileData.experience);
          formData.append('serviceArea', profileData.serviceArea);
          if (fileUploads.resume) formData.append('resume', fileUploads.resume);
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
          if (fileUploads.passbookImage) formData.append('passbookImage', fileUploads.passbookImage);
          break;
        case 'profilePic':
          if (!fileUploads.profilePic) throw new Error('Please select a profile picture');
          formData.append('profilePic', fileUploads.profilePic);
          break;
        case 'resume':
          if (!fileUploads.resume) throw new Error('Please select a resume file');
          formData.append('resume', fileUploads.resume);
          break;
      }

      const response = await ProviderService.updateProfile(formData);
      const data = response.data;

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

  const viewDocument = async (type) => {
    try {
      const response = await ProviderService.viewDocument(type);
      const data = response.data;
      if (data.success) {
        setDocumentModal({ isOpen: true, type, url: data.fileUrl });
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const deleteAccount = async () => {
    if (!deleteModal.confirmed) {
      showToast('Please confirm the action', 'error');
      return;
    }
    try {
      const response = await ProviderService.deleteAccount();
      const data = response.data;
      if (data.success) {
        showToast('Account deleted successfully');
        logoutUser();
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const calculateProfileCompletion = () => {
    const fields = [
      profileData.name, profileData.phone, profileData.dateOfBirth,
      profileData.services?.length > 0, profileData.experience, profileData.serviceArea,
      profileData.address.street, profileData.address.city, profileData.address.state,
      profileData.address.postalCode, profileData.bankDetails.accountNo, profileData.bankDetails.ifsc,
      profileData.profilePicUrl, profileData.resume, profileData.bankDetails.passbookImage
    ];
    const completed = fields.filter(f => f && f !== false).length;
    return Math.round((completed / fields.length) * 100);
  };

  const formatServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Not added';
    return services.map(id => serviceMap[id] || id).join(', ') || 'Not added';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const completion = calculateProfileCompletion();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-background rounded-2xl shadow-sm p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <img src={profileData.profilePicUrl || '/default-provider.jpg'} alt={profileData.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary" onError={(e) => e.target.src = '/default-provider.jpg'} />
              <div>
                <h1 className="text-xl font-bold text-secondary">{profileData.name || 'Provider'}</h1>
                <p className="text-gray-500 text-sm">{profileData.email}</p>
                <p className="text-gray-500 text-sm">{profileData.phone || '+91 XXXXXXXXXX'}</p>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Provider ID: {profileData.providerId || 'N/A'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {profileData.isActive && <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">✓ Active</span>}
              {profileData.approved && <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">✓ Approved</span>}
              {profileData.kycStatus === 'approved' && <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full">✓ KYC Verified</span>}
            </div>
          </div>
        </div>

        {/* Completion */}
        <div className="bg-background rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Profile Completion</span>
            <span className="text-lg font-semibold text-primary">{completion}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-background rounded-2xl shadow-sm p-4 border border-gray-100">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-black">Completed</p>
            <p className="text-3xl font-black text-secondary mt-1">{profileData.completedBookings || 0}</p>
          </div>
          <div className="bg-background rounded-2xl shadow-sm p-4 border border-gray-100">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-black">Cancelled</p>
            <p className="text-3xl font-black text-secondary mt-1">{profileData.canceledBookings || 0}</p>
          </div>
          <div className="bg-background rounded-2xl shadow-sm p-4 border border-gray-100">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-black">Rating</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-secondary">{profileData.averageRating || '0'}</span>
              <span className="text-yellow-400 text-2xl">★</span>
            </div>
          </div>
          <div className="bg-background rounded-2xl shadow-sm p-4 border border-teal-100">
            <p className="text-primary text-[10px] uppercase tracking-widest font-black">Wallet</p>
            <p className="text-2xl font-black text-secondary mt-1">₹{profileData.wallet?.availableBalance || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-background rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {['overview', 'documents', 'profile'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-4 text-sm font-semibold transition-all relative ${activeTab === tab ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Account Details */}
                  <div>
                    <h3 className="text-xs font-black text-secondary/60 uppercase tracking-widest mb-4">Account Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Provider ID</span>
                        <span className="text-sm font-black text-primary">{profileData.providerId || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Member Since</span>
                        <span className="text-sm font-bold text-secondary">
                          {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Test Status</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${profileData.testPassed ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                          {profileData.testPassed ? '✓ Qualified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Service Info */}
                  <div>
                    <h3 className="text-xs font-black text-secondary/60 uppercase tracking-widest mb-4">Service Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Services</span>
                        <span className="text-sm font-bold text-secondary text-right">{formatServices(profileData.services)}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Experience</span>
                        <span className="text-sm font-black text-primary">
                          {profileData.experience ? `${profileData.experience} Years` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Total Reviews</span>
                        <span className="text-sm font-bold text-secondary">{profileData.ratingCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Details */}
                  <div>
                    <h3 className="text-xs font-black text-secondary/60 uppercase tracking-widest mb-4">Wallet Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                        <span className="text-sm text-primary font-bold font-inter">Available</span>
                        <span className="text-xl font-black text-secondary">₹{profileData.wallet?.availableBalance || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Withdrawn</span>
                        <span className="text-sm font-bold text-secondary">₹{profileData.wallet?.totalWithdrawn || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <span className="text-sm text-gray-500 font-medium font-inter">Last Update</span>
                        <span className="text-sm font-bold text-secondary text-right">
                          {profileData.wallet?.lastUpdated ? new Date(profileData.wallet.lastUpdated).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {profileData.blockedTill && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700"><span className="font-semibold">🔒 Account Blocked</span> until {new Date(profileData.blockedTill).toLocaleDateString()}</p>
                  </div>
                )}
                {profileData.kycStatus === 'rejected' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-800">⚠️ KYC Rejected</p>
                    <p className="text-sm text-red-700 mt-1">{profileData.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === 'documents' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Profile Picture */}
                <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                  <div className="w-16 h-16 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                    <Camera className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-secondary text-sm mb-2">Profile Photo</h4>
                  <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.profilePicUrl ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'
                    }`}>
                    {profileData.profilePicUrl ? '✓ Stored' : '✗ Required'}
                  </span>
                  <div className="space-y-2">
                    <input id="profilePicUpload" type="file" onChange={(e) => handleFileChange(e, 'profilePic')} accept="image/*" className="hidden" />
                    <label htmlFor="profilePicUpload" className="block w-full px-4 py-2.5 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                      <Upload className="w-3.5 h-3.5 inline mr-2" /> Change Photo
                    </label>
                    {fileUploads.profilePic && (
                      <button onClick={() => updateProfile('profilePic')} className="block w-full px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-black shadow-lg shadow-accent/20">
                        <Check className="w-3.5 h-3.5 inline mr-2" /> Upload Now
                      </button>
                    )}
                    {profileData.profilePicUrl && (
                      <button onClick={() => viewDocument('profile')} className="block w-full px-4 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity">
                        <Eye className="w-3.5 h-3.5 inline mr-2" /> View Current
                      </button>
                    )}
                  </div>
                </div>

                  {/* Experience ID Proof */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-16 h-16 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2 uppercase tracking-tight">Experience / ID Proof</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.resume ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'
                      }`}>
                      {profileData.resume ? '✓ Verified Proof' : '✗ Multi-Proof ID'}
                    </span>
                    <div className="space-y-2">
                      <input id="resumeUpload" type="file" onChange={(e) => handleFileChange(e, 'resume')} accept=".pdf,.doc,.docx,image/*" className="hidden" />
                      <label htmlFor="resumeUpload" className="block w-full px-4 py-2.5 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                        <Upload className="w-3.5 h-3.5 inline mr-2" /> Upload ID Proof
                      </label>
                      {fileUploads.resume && (
                        <button onClick={() => updateProfile('resume')} className="block w-full px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-black shadow-lg shadow-accent/20">
                          <Check className="w-3.5 h-3.5 inline mr-2" /> Submit Document
                        </button>
                      )}
                      {profileData.resume && (
                        <button onClick={() => viewDocument('resume')} className="block w-full px-4 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Document
                        </button>
                      )}
                    </div>
                  </div>

                {/* Passbook */}
                <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                  <div className="w-16 h-16 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-secondary text-sm mb-2">Bank Passbook</h4>
                  <div className="flex flex-col gap-1 items-center mb-4">
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full ${profileData.bankDetails.passbookImage ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'
                      }`}>
                      {profileData.bankDetails.passbookImage ? '✓ Stored' : '✗ Required'}
                    </span>
                    {profileData.bankDetails.verified && (
                      <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full bg-blue-50 text-blue-600">✓ Bank Verified</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input id="passbookUpload" type="file" onChange={(e) => handleFileChange(e, 'passbookImage')} accept="image/*" className="hidden" />
                    <label htmlFor="passbookUpload" className="block w-full px-4 py-2.5 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                      <Upload className="w-3.5 h-3.5 inline mr-2" /> Change File
                    </label>
                    {fileUploads.passbookImage && (
                      <button onClick={() => updateProfile('bank')} className="block w-full px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-black shadow-lg shadow-accent/20">
                        <Check className="w-3.5 h-3.5 inline mr-2" /> Upload Now
                      </button>
                    )}
                    {profileData.bankDetails.passbookImage && (
                      <button onClick={() => viewDocument('passbook')} className="block w-full px-4 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity">
                        <Eye className="w-3.5 h-3.5 inline mr-2" /> View Current
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Basic Info */}
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs font-black text-secondary/60 uppercase tracking-widest">Basic Information</h3>
                      <button onClick={() => setEditMode({ ...editMode, basic: !editMode.basic })}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition-all ${editMode.basic ? 'bg-gray-100 text-secondary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-sm'
                          }`}>
                        {editMode.basic ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        {editMode.basic ? 'Cancel' : 'Edit Profile'}
                      </button>
                    </div>

                    {editMode.basic ? (
                      <form onSubmit={(e) => { e.preventDefault(); updateProfile('basic'); }} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-tighter">Full Name</label>
                          <input type="text" name="name" value={profileData.name} onChange={(e) => handleChange(e)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-secondary text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-tighter">Phone Number</label>
                            <input type="tel" name="phone" value={profileData.phone} onChange={(e) => handleChange(e)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-secondary text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-tighter">Birth Date</label>
                            <DatePicker selected={profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null}
                              onChange={(date) => {
                                const localDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                                setProfileData(prev => ({ ...prev, dateOfBirth: localDate }));
                              }}
                              dateFormat="yyyy-MM-dd" maxDate={new Date()}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-secondary text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-2">
                          <button type="button" onClick={() => setEditMode({ ...editMode, basic: false })}
                            className="px-6 py-2.5 text-xs font-bold text-gray-500 hover:text-secondary">Discard</button>
                          <button type="submit" className="px-8 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-accent rounded-xl shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95">Save Changes</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-50">
                          <span className="text-sm text-gray-400 font-medium">Full Identity</span>
                          <span className="text-sm font-black text-secondary uppercase tracking-tighter">{profileData.name || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200/50">
                          <span className="text-sm text-gray-400 font-medium">Email Address</span>
                          <span className="text-sm font-bold text-secondary">{profileData.email}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-gray-200/50">
                          <span className="text-sm text-gray-400 font-medium">Contact Number</span>
                          <span className="text-sm font-bold text-secondary">{profileData.phone || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400 font-medium">Date of Birth</span>
                          <span className="text-sm font-bold text-secondary">
                            {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Professional Info */}
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs font-black text-secondary/60 uppercase tracking-widest">Professional Identity</h3>
                      <button onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition-all ${editMode.professional ? 'bg-gray-100 text-secondary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-sm'
                          }`}>
                        {editMode.professional ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        {editMode.professional ? 'Cancel' : 'Edit Expertise'}
                      </button>
                    </div>

                    {editMode.professional ? (
                      <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">Services (Max 3)</label>
                          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                            {providerServicesLoading ? (
                              <div className="col-span-2 text-center py-8 text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                              </div>
                            ) : (
                              providerServices.map(service => (
                                <label key={service._id} className="flex items-center gap-2">
                                  <input type="checkbox" checked={(profileData.services || []).includes(service._id)}
                                    onChange={() => handleServiceChange(service._id)}
                                    disabled={(profileData.services || []).length >= 3 && !(profileData.services || []).includes(service._id)}
                                    className="w-4 h-4 text-primary rounded" />
                                  <span className="text-sm text-gray-700">{service.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Selected: {(profileData.services || []).length}/3</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">Experience</label>
                            <input type="number" name="experience" value={profileData.experience || ''}
                              onChange={(e) => handleChange(e)} placeholder="Years"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">Service Area</label>
                            <input type="text" name="serviceArea" value={profileData.serviceArea || ''}
                              onChange={(e) => handleChange(e)} placeholder="Area"
                              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <button type="button" onClick={() => setEditMode({ ...editMode, professional: false })}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90">Save</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                          <span className="text-sm text-gray-600">Services</span>
                          <span className="text-sm font-semibold text-secondary">{formatServices(profileData.services)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                          <span className="text-sm text-gray-600">Experience</span>
                          <span className="text-sm font-semibold text-secondary">
                            {profileData.experience ? `${profileData.experience} years` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Service Area</span>
                          <span className="text-sm font-semibold text-secondary">{profileData.serviceArea || '—'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Address</h3>
                      <button onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${editMode.address ? 'bg-white text-secondary border border-gray-200' : 'bg-primary text-white'
                          }`}>
                        {editMode.address ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        {editMode.address ? 'Cancel' : 'Edit'}
                      </button>
                    </div>

                    {editMode.address ? (
                      <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" name="street" placeholder="Street" value={profileData.address.street}
                            onChange={(e) => handleChange(e, 'address')} className="col-span-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="city" placeholder="City" value={profileData.address.city}
                            onChange={(e) => handleChange(e, 'address')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="state" placeholder="State" value={profileData.address.state}
                            onChange={(e) => handleChange(e, 'address')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="postalCode" placeholder="Postal Code" value={profileData.address.postalCode}
                            onChange={(e) => handleChange(e, 'address')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="country" placeholder="Country" value={profileData.address.country}
                            onChange={(e) => handleChange(e, 'address')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <button type="button" onClick={() => setEditMode({ ...editMode, address: false })}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90">Save</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        {[
                          { label: 'Street', value: profileData.address.street },
                          { label: 'City', value: profileData.address.city },
                          { label: 'State', value: profileData.address.state },
                          { label: 'Postal Code', value: profileData.address.postalCode },
                          { label: 'Country', value: profileData.address.country }
                        ].map((item, idx) => (
                          <div key={idx} className={`flex justify-between items-center pb-3 ${idx < 4 ? 'border-b border-gray-200' : ''}`}>
                            <span className="text-sm text-gray-600">{item.label}</span>
                            <span className="text-sm font-semibold text-secondary">{item.value || '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bank */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Bank Details</h3>
                      <button onClick={() => setEditMode({ ...editMode, bank: !editMode.bank })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors ${editMode.bank ? 'bg-white text-secondary border border-gray-200' : 'bg-primary text-white'
                          }`}>
                        {editMode.bank ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        {editMode.bank ? 'Cancel' : 'Edit'}
                      </button>
                    </div>

                    {editMode.bank ? (
                      <form onSubmit={(e) => { e.preventDefault(); updateProfile('bank'); }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" name="accountNo" placeholder="Account Number" value={profileData.bankDetails.accountNo}
                            onChange={(e) => handleChange(e, 'bank')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="ifsc" placeholder="IFSC Code" value={profileData.bankDetails.ifsc}
                            onChange={(e) => handleChange(e, 'bank')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="bankName" placeholder="Bank Name" value={profileData.bankDetails.bankName}
                            onChange={(e) => handleChange(e, 'bank')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                          <input type="text" name="accountName" placeholder="Account Holder" value={profileData.bankDetails.accountName}
                            onChange={(e) => handleChange(e, 'bank')} className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-secondary" />
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <button type="button" onClick={() => setEditMode({ ...editMode, bank: false })}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90">Save</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        {[
                          { label: 'Account Number', value: profileData.bankDetails.accountNo ? `****${profileData.bankDetails.accountNo.slice(-4)}` : '—' },
                          { label: 'IFSC Code', value: profileData.bankDetails.ifsc || '—' },
                          { label: 'Bank Name', value: profileData.bankDetails.bankName || '—' },
                          { label: 'Account Holder', value: profileData.bankDetails.accountName || '—' }
                        ].map((item, idx) => (
                          <div key={idx} className={`flex justify-between items-center pb-3 ${idx < 3 ? 'border-b border-gray-200' : ''}`}>
                            <span className="text-sm text-gray-600">{item.label}</span>
                            <span className="text-sm font-semibold text-secondary">{item.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm text-gray-600">Verification</span>
                          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${profileData.bankDetails.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {profileData.bankDetails.verified ? '✓ Verified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide">Delete Account</h3>
                      <p className="text-xs text-red-700 mt-1">Permanently delete your account and all data</p>
                    </div>
                    <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: true })}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Modal */}
      {documentModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-secondary capitalize">{documentModal.type} Document</h3>
              <button onClick={() => setDocumentModal({ isOpen: false, type: null, url: null })}
                className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex flex-col">
              {documentModal.type === 'profile' || documentModal.type === 'passbook' ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <img src={documentModal.url} alt={documentModal.type} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-gray-200"
                    onError={() => showToast('Failed to load image', 'error')} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <iframe src={documentModal.url} className="w-full flex-1 border-0" style={{ minHeight: '60vh' }} title="Document Viewer"
                    onError={() => showToast('Failed to load document', 'error')} />
                  <div className="p-4 bg-white border-t border-gray-100 flex justify-center gap-3">
                    <a href={documentModal.url} target="_blank" rel="noopener noreferrer"
                      className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 flex items-center gap-2 shadow-sm transition-all">
                      <Eye className="w-4 h-4" /> Open Full Screen
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-secondary">Delete Account</h3>
                <p className="text-xs text-gray-500">Permanent action</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-4 mb-4 space-y-2 border border-red-100">
              <p className="text-xs font-semibold text-red-800">⚠️ This cannot be undone:</p>
              <ul className="text-xs text-red-700 space-y-1 ml-4">
                <li>• All data permanently deleted</li>
                <li>• Profile removed from platform</li>
                <li>• Pending bookings cancelled</li>
              </ul>
            </div>

            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={deleteModal.confirmed}
                onChange={(e) => setDeleteModal({ ...deleteModal, confirmed: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-xs text-gray-700 font-medium">I understand this is irreversible</span>
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={deleteAccount} disabled={!deleteModal.confirmed}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${deleteModal.confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'
                  }`}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;