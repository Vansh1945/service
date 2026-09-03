import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/auth';
import { toast } from '../../../components/ui/Toast';
import 'react-datepicker/dist/react-datepicker.css';

import { AlertCircle, X, Eye, Camera, FileText, CreditCard, Bell, User, ArrowLeft, ChevronRight, Star, LogOut } from 'lucide-react';
import * as ProviderService from '../../../services/ProviderService';
import useCategory from '../../../hooks/useCategory';
import { formatCurrency, compressImage } from '../../../utils/format';
import ProfileSkeleton from '../../../components/ui-skeletons/ProfileSkeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import PayoutProfileTab from './components/PayoutProfileTab';
import DocumentsTab from './components/DocumentsTab';
import PersonalDetailsTab from './components/PersonalDetailsTab';
import NotificationSettingsTab from './components/NotificationSettingsTab';

const ProviderProfile = () => {
  const { token, API, showToast, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'profile');
  const [documentModal, setDocumentModal] = useState({ isOpen: false, type: null, url: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, confirmed: false });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const navigationItems = [
    { id: 'profile', label: 'Personal Details', icon: <User className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'payout', label: 'Payout Settings', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'settings', label: 'Notification Settings', icon: <Bell className="w-4 h-4" /> }
  ];

  const quickActions = [
    { id: 'profile', label: 'Profile Details', icon: <User className="w-5 h-5" />, color: 'bg-amber-50 text-amber-500' },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" />, color: 'bg-rose-50 text-rose-500' },
    { id: 'payout', label: 'Payout Settings', icon: <CreditCard className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600' },
    { id: 'settings', label: 'Settings', icon: <Bell className="w-5 h-5" />, color: 'bg-blue-50 text-blue-500' }
  ];


  // Profile Data State
  const [profileData, setProfileData] = useState({
    name: '', email: '', phone: '', dateOfBirth: '', role: '', services: [],
    experience: '', serviceArea: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      lat: null,
      lng: null,
      s2CellId: null,
      s2CellIdPrecise: null
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
    aadhaarFront: '',
    aadhaarFrontPublicId: '',
    aadhaarBack: '',
    aadhaarBackPublicId: '',
    panCard: '',
    panCardPublicId: '',
    liveSelfie: '',
    liveSelfiePublicId: '',
    addressSame: false,
    currentAddress: {
      houseNumber: '',
      street: '',
      landmark: '',
      villageCity: '',
      district: '',
      state: '',
      pincode: ''
    },
    permanentAddress: {
      houseNumber: '',
      street: '',
      landmark: '',
      villageCity: '',
      district: '',
      state: '',
      pincode: ''
    },
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
    providerId: '',
    notificationPreferences: {
      bookingAlertTone: true,
      bookingVibration: true,
      bookingAlertDuration: 30,
      bookingRepeatAlert: false
    }
  });

  const [editMode, setEditMode] = useState({ basic: false, professional: false, address: false, bank: false, kyc: false });
  const [isBankValid, setIsBankValid] = useState(false);

  const [fileUploads, setFileUploads] = useState({
    profilePic: null,
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    liveSelfie: null,
    passbookImage: null
  });
  const { categories: providerServices, loading: providerServicesLoading } = useCategory();
  const [loading, setLoading] = useState(false);

  const getKycBadge = (status) => {
    switch (status) {
      case 'approved':
        return { label: 'Verified', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700' };
      case 'rejected':
        return { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700' };
      case 'pending':
        return { label: 'Under Review', bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700' };
      default:
        return { label: 'Not Submitted', bg: 'bg-neutral-100 text-neutral-600 border-neutral-200', text: 'text-neutral-600' };
    }
  };
  const kycBadge = getKycBadge(profileData.kycStatus);

  const serviceMap = providerServices.reduce((acc, s) => { acc[s.value] = s.label; return acc; }, {});

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
            address: data.provider.address || { street: '', city: '', state: '', postalCode: '', country: 'India', lat: null, lng: null },
            bankDetails: data.provider.bankDetails || { accountNo: '', ifsc: '', bankName: '', accountName: '', passbookImage: '', passbookImagePublicId: '', verified: false },
            notificationPreferences: data.provider.notificationPreferences || {
              bookingAlertTone: true,
              bookingVibration: true,
              bookingAlertDuration: 30,
              bookingRepeatAlert: false
            },
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

    fetchProfile();
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
      setProfileData(prev => {
        const updatedAddress = { ...prev.address, [name]: value };
        if (name === 'postalCode') {
          updatedAddress.pincode = value;
        } else if (name === 'pincode') {
          updatedAddress.postalCode = value;
        }

        // Construct street address dynamically
        const parts = [];
        if (updatedAddress.houseNumber) parts.push(updatedAddress.houseNumber);
        if (updatedAddress.road) parts.push(updatedAddress.road);
        updatedAddress.street = parts.join(', ') || updatedAddress.street || '';
        updatedAddress.addressLine = updatedAddress.street;

        // Update formatted address preview
        updatedAddress.formattedAddress = buildAddressPreview(updatedAddress);

        return {
          ...prev,
          address: updatedAddress
        };
      });
    } else if (section === 'bank') {
      setProfileData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [name]: value } }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePreferenceChange = (name, value) => {
    setProfileData(prev => {
      const currentPrefs = prev.notificationPreferences || {
        bookingAlertTone: true,
        bookingVibration: true,
        bookingAlertDuration: 30,
        bookingRepeatAlert: false
      };
      return {
        ...prev,
        notificationPreferences: {
          ...currentPrefs,
          [name]: value
        }
      };
    });
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const kycFields = ['aadhaarFront', 'aadhaarBack', 'panCard', 'liveSelfie', 'passbookImage'];
    if (kycFields.includes(field)) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Only JPG, JPEG, PNG, WEBP, and PDF files are allowed', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must not exceed 5 MB', 'error');
        return;
      }
    }
    setFileUploads(prev => ({ ...prev, [field]: file }));
  };

  const updateProfile = async (updateType) => {
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append('updateType', updateType);

      // Compress upload files in parallel using Promise.all
      const [
        profilePicFile,
        aadhaarFrontFile,
        aadhaarBackFile,
        panCardFile,
        liveSelfieFile,
        passbookImageFile
      ] = await Promise.all([
        fileUploads.profilePic ? compressImage(fileUploads.profilePic, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }) : null,
        fileUploads.aadhaarFront ? compressImage(fileUploads.aadhaarFront, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }) : null,
        fileUploads.aadhaarBack ? compressImage(fileUploads.aadhaarBack, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }) : null,
        fileUploads.panCard ? compressImage(fileUploads.panCard, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }) : null,
        fileUploads.liveSelfie ? compressImage(fileUploads.liveSelfie, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }) : null,
        fileUploads.passbookImage ? compressImage(fileUploads.passbookImage, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 }) : null
      ]);

      switch (updateType) {
        case 'basic':
          formData.append('name', profileData.name);
          formData.append('phone', profileData.phone);
          formData.append('dateOfBirth', profileData.dateOfBirth);
          if (profilePicFile) formData.append('profilePic', profilePicFile);
          break;
        case 'professional':
          formData.append('services', JSON.stringify(profileData.services));
          formData.append('experience', profileData.experience);
          formData.append('serviceArea', profileData.serviceArea);
          break;
        case 'address':
          formData.append('addressSame', profileData.addressSame);
          formData.append('currentAddress', JSON.stringify(profileData.currentAddress));
          formData.append('permanentAddress', JSON.stringify(profileData.addressSame ? profileData.currentAddress : profileData.permanentAddress));
          // Backward compatibility mappings
          formData.append('street', profileData.currentAddress.street || '');
          formData.append('city', profileData.currentAddress.villageCity || '');
          formData.append('state', profileData.currentAddress.state || '');
          formData.append('postalCode', profileData.currentAddress.pincode || '');
          formData.append('country', 'India');
          if (profileData.address && profileData.address.lat !== undefined && profileData.address.lat !== null) {
            formData.append('lat', profileData.address.lat);
          }
          if (profileData.address && profileData.address.lng !== undefined && profileData.address.lng !== null) {
            formData.append('lng', profileData.address.lng);
          }
          break;
        case 'bank':
          formData.append('accountNo', profileData.bankDetails.accountNo);
          formData.append('ifsc', profileData.bankDetails.ifsc);
          formData.append('bankName', profileData.bankDetails.bankName);
          formData.append('accountName', profileData.bankDetails.accountName);
          if (passbookImageFile) formData.append('passbookImage', passbookImageFile);
          break;
        case 'profilePic':
          if (!profilePicFile) throw new Error('Please select a profile picture');
          formData.append('profilePic', profilePicFile);
          break;
        case 'kyc':
          if (aadhaarFrontFile) formData.append('aadhaarFront', aadhaarFrontFile);
          if (aadhaarBackFile) formData.append('aadhaarBack', aadhaarBackFile);
          if (panCardFile) formData.append('panCard', panCardFile);
          if (liveSelfieFile) formData.append('liveSelfie', liveSelfieFile);
          break;
        case 'aadhaarFront':
          if (!aadhaarFrontFile) throw new Error('Please select Aadhaar Front image');
          formData.append('aadhaarFront', aadhaarFrontFile);
          break;
        case 'aadhaarBack':
          if (!aadhaarBackFile) throw new Error('Please select Aadhaar Back image');
          formData.append('aadhaarBack', aadhaarBackFile);
          break;
        case 'panCard':
          if (!panCardFile) throw new Error('Please select PAN Card image');
          formData.append('panCard', panCardFile);
          break;
        case 'liveSelfie':
          if (!liveSelfieFile) throw new Error('Please select Live Selfie image');
          formData.append('liveSelfie', liveSelfieFile);
          break;
        case 'settings':
          const currentPrefs = profileData.notificationPreferences || {
            bookingAlertTone: true,
            bookingVibration: true,
            bookingAlertDuration: 30,
            bookingRepeatAlert: false
          };
          formData.append('notificationPreferences', JSON.stringify({
            bookingAlertTone: currentPrefs.bookingAlertTone !== false,
            bookingVibration: currentPrefs.bookingVibration !== false,
            bookingAlertDuration: Number(currentPrefs.bookingAlertDuration || 30),
            bookingRepeatAlert: currentPrefs.bookingRepeatAlert === true
          }));
          break;
      }

      const response = await ProviderService.updateProfile(formData);
      const data = response.data;

      if (data.success) {
        setProfileData(prev => ({
          ...prev,
          ...data.provider,
          address: data.provider.address || prev.address,
          bankDetails: data.provider.bankDetails || prev.bankDetails,
          notificationPreferences: data.provider.notificationPreferences || prev.notificationPreferences
        }));
        setFileUploads({ profilePic: null, aadhaarFront: null, aadhaarBack: null, panCard: null, liveSelfie: null, passbookImage: null });
        setEditMode({ basic: false, professional: false, address: false, bank: false, kyc: false });
        showToast(data.message || 'Profile updated successfully');
      } else {
        showToast(data.message, 'error');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
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
        showToast(data.message || 'Account deletion request submitted to Admin for review', 'success');
        setTimeout(() => logoutUser(), 1500);
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
      profileData.currentAddress?.street, profileData.currentAddress?.villageCity, profileData.currentAddress?.state,
      profileData.currentAddress?.pincode, profileData.bankDetails.accountNo, profileData.bankDetails.ifsc,
      profileData.profilePicUrl, profileData.aadhaarFront, profileData.aadhaarBack, profileData.panCard, profileData.liveSelfie, profileData.bankDetails.passbookImage
    ];
    const completed = fields.filter(f => f && f !== false).length;
    return Math.round((completed / fields.length) * 100);
  };

  const formatServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Not added';
    return services.map(svc => {
      if (!svc) return '';
      if (typeof svc === 'object') return svc.name || svc.title || svc.label || serviceMap[svc._id || svc.id] || svc._id;
      return serviceMap[svc] || svc;
    }).filter(Boolean).join(', ') || 'Not added';
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  const completion = calculateProfileCompletion();

  const renderBackHeader = (title) => (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-100">
      <button onClick={() => { setActiveTab('profile'); setEditMode({ basic: false, professional: false, address: false, bank: false }); }} className="p-1 rounded-full hover:bg-neutral-100 transition-colors" title="Back to Profile">
        <ArrowLeft className="w-5 h-5 text-neutral-600" />
      </button>
      <h2 className="text-sm font-black text-secondary uppercase tracking-wider">{title}</h2>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-neutral-50/50 pb-12 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

            {/* Desktop Sidebar Layout */}
            <div className="hidden xl:block space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-100 p-2 shadow-sm">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setEditMode({ basic: false, professional: false, address: false, bank: false }); }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group ${activeTab === item.id ? 'bg-primary/5 text-primary' : 'text-neutral-500 hover:bg-neutral-50'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={activeTab === item.id ? 'text-primary' : 'text-neutral-400 group-hover:text-secondary'}>
                        {item.icon}
                      </div>
                      <span className={`text-xs font-bold ${activeTab === item.id ? 'text-primary' : 'text-secondary'}`}>
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
                <div className="pt-2 border-t border-neutral-100 mt-2">
                  <button
                    onClick={logoutUser}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-neutral-500 hover:bg-danger/5 hover:text-danger transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4 text-neutral-400 group-hover:text-danger" />
                      <span className="text-xs font-bold">Logout</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Compact Quick Stats */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm space-y-3">
                <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Quick Stats</h4>
                <div className="space-y-2 text-xs font-bold text-secondary">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Completed</span>
                    <span>{profileData.completedBookings || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Cancelled</span>
                    <span>{profileData.canceledBookings || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Rating</span>
                    <span className="text-warning flex items-center gap-0.5"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {profileData.averageRating || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Wallet</span>
                    <span className="text-success">{formatCurrency(profileData.wallet?.availableBalance || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="xl:col-span-3 space-y-5">

              {/* Profile Header View & Personal Details */}
              {activeTab === 'profile' && (
                <>
                  {/* Compact Profile Header Card */}
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden text-left">
                    <div className="h-10 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
                    <div className="px-4 pb-4 -mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative group shrink-0">
                          <img
                            src={profileData.profilePicUrl || `https://ui-avatars.com/api/?name=${profileData.name || 'Provider'}&background=0D9488&color=fff`}
                            alt="Profile"
                            className="w-14 h-14 rounded-xl border-2 border-white object-cover shadow-sm bg-neutral-50"
                          />
                          <label className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 cursor-pointer shadow hover:bg-primary/95 transition-colors">
                            <Camera className="w-3 h-3" />
                            <input type="file" onChange={(e) => handleFileChange(e, 'profilePic')} accept="image/*" className="hidden" />
                          </label>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm font-black text-secondary truncate">{profileData.name || 'Provider'}</h2>
                            <div className="flex gap-1 flex-wrap">
                              {profileData.isActive && <span className="inline-flex items-center text-[9px] font-black bg-success/15 text-emerald-700 px-1.5 py-0.5 rounded select-none">Active</span>}
                              {profileData.approved && <span className="inline-flex items-center text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded select-none">Approved</span>}
                              {profileData.kycStatus === 'approved' && <span className="inline-flex items-center text-[9px] font-black bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded select-none">KYC Verified</span>}
                            </div>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-bold mt-0.5 truncate">{profileData.email}</p>
                          <p className="text-[10px] text-neutral-400 font-bold mt-0.5">{profileData.phone || 'Add phone number'}</p>
                          {fileUploads.profilePic && (
                            <button onClick={() => updateProfile('profilePic')} className="mt-1 text-[9px] bg-primary text-white px-2 py-0.5 rounded font-black hover:opacity-90 transition-opacity">
                              Upload Pic
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Quick Actions Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => {
                          if (action.action) action.action();
                          else { setActiveTab(action.id); setEditMode({ basic: false, professional: false, address: false, bank: false }); }
                        }}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:bg-neutral-50 transition-colors"
                      >
                        <div className={`p-2.5 rounded-xl ${action.color}`}>
                          {action.icon}
                        </div>
                        <span className="text-[10px] font-black text-secondary tracking-tight">{action.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Personal Details Component */}
                  <PersonalDetailsTab
                    profileData={profileData}
                    setProfileData={setProfileData}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    isSaving={isSaving}
                    handleChange={handleChange}
                    updateProfile={updateProfile}
                    formatServices={formatServices}
                    allCategories={providerServices}
                  />

                  {/* Delete Account Card (Danger Zone - Placed at Very Bottom) */}
                  <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-left">
                    <div>
                      <p className="text-xs font-black text-rose-800 uppercase tracking-wide">Delete Account</p>
                      <p className="text-[10px] text-rose-600 font-bold mt-1">Permanently delete your account and all professional data from the platform.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteModal({ ...deleteModal, isOpen: true })}
                      className="w-full sm:w-auto bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-700 transition-colors shadow-sm select-none"
                    >
                      Delete Account
                    </button>
                  </div>
                </>
              )}

              {/* Documents View */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  {renderBackHeader('Uploaded Documents')}
                  <DocumentsTab
                    profileData={profileData}
                    kycBadge={kycBadge}
                    uploadingDoc={fileUploads.aadhaarFront ? 'aadhaarFront' : fileUploads.aadhaarBack ? 'aadhaarBack' : fileUploads.panCard ? 'panCard' : fileUploads.liveSelfie ? 'liveSelfie' : null}
                    handleFileUpload={(type, file) => {
                      setFileUploads(prev => ({ ...prev, [type]: file }));
                      updateProfile(type);
                    }}
                    setPreviewImage={(url) => setDocumentModal({ isOpen: true, type: 'document', url })}
                  />
                </div>
              )}



              {/* Settings View */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  {renderBackHeader('Notification Settings')}
                  <NotificationSettingsTab
                    notificationSettings={profileData.notificationPreferences}
                    setNotificationSettings={(fn) => {
                      setProfileData(prev => ({
                        ...prev,
                        notificationPreferences: typeof fn === 'function' ? fn(prev.notificationPreferences || {}) : fn
                      }));
                    }}
                    isSaving={isSaving}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* Payout Settings Tab */}
              {activeTab === 'payout' && (
                <div className="space-y-4">
                  {renderBackHeader('Payout Profile & Withdrawal Center')}
                  <PayoutProfileTab showToast={showToast} profileData={profileData} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Modal */}
      {documentModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-secondary">Request Account Deletion</h3>
                <p className="text-xs text-gray-500">Requires Admin Verification & Approval</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-4 mb-4 space-y-2 border border-red-100">
              <p className="text-xs font-semibold text-red-800">⚠️ Request submitted to Admin for review:</p>
              <ul className="text-xs text-red-700 space-y-1.5 ml-2">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">•</span>
                  <span>Your request will be sent to Admin for manual account review</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">•</span>
                  <span>All profile data and documents will be permanently deleted upon approval</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">•</span>
                  <span>All pending & scheduled bookings will be cancelled</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">•</span>
                  <span>All payment history & transaction records will be deleted</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold shrink-0">•</span>
                  <span>Unclaimed wallet balance & pending payouts will be forfeited to company</span>
                </li>
              </ul>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={deleteModal.confirmed}
                onChange={(e) => setDeleteModal({ ...deleteModal, confirmed: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded" />
              <span className="text-xs text-gray-700 font-medium">I understand this request will be sent to Admin for review</span>
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={deleteAccount} disabled={!deleteModal.confirmed}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${deleteModal.confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`}>
                Submit Deletion Request
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProviderProfile;