import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import { Loader2, AlertCircle, Edit2, X, Check, Upload, Eye, Camera, FileText, CreditCard, Bell, Shield, Package, Wallet, User, MapPin, ArrowLeft, ChevronRight, Star, LogOut } from 'lucide-react';
import * as ProviderService from '../../services/ProviderService';
import * as NotificationService from '../../services/NotificationService';
import useCategory from '../../hooks/useCategory';
import { formatDate, formatCurrency, compressImage } from '../../utils/format';
import AddressSelector from '../../components/AddressSelector';
import { IfscBankDetails } from '../../components/IfscBankDetails';
import ProfileSkeleton from '../../components/ui-skeletons/ProfileSkeleton';
import { useNavigate } from 'react-router-dom';
import Processing from '../../components/ui-skeletons/Processing';

const ProviderProfile = () => {
  const { token, API, showToast, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [documentModal, setDocumentModal] = useState({ isOpen: false, type: null, url: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, confirmed: false });
  const [isSaving, setIsSaving] = useState(false);

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: <Package className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'profile', label: 'Personal Details', icon: <User className="w-4 h-4" /> },
    { id: 'settings', label: 'Notification Settings', icon: <Bell className="w-4 h-4" /> }
  ];

  const quickActions = [
    { id: 'overview', label: 'Overview', icon: <Package className="w-5 h-5" />, color: 'bg-primary/10 text-primary' },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" />, color: 'bg-rose-50 text-rose-500' },
    { id: 'profile', label: 'Profile Details', icon: <User className="w-5 h-5" />, color: 'bg-amber-50 text-amber-500' },
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

    const kycFields = ['aadhaarFront', 'aadhaarBack', 'panCard', 'liveSelfie'];
    if (kycFields.includes(field)) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Only JPG, JPEG, PNG, and WEBP images are allowed', 'error');
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

      // Compress upload files if present before packaging into FormData
      let profilePicFile = fileUploads.profilePic;
      if (profilePicFile) {
        profilePicFile = await compressImage(profilePicFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
      }

      let aadhaarFrontFile = fileUploads.aadhaarFront;
      if (aadhaarFrontFile) {
        aadhaarFrontFile = await compressImage(aadhaarFrontFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      }

      let aadhaarBackFile = fileUploads.aadhaarBack;
      if (aadhaarBackFile) {
        aadhaarBackFile = await compressImage(aadhaarBackFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      }

      let panCardFile = fileUploads.panCard;
      if (panCardFile) {
        panCardFile = await compressImage(panCardFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      }

      let liveSelfieFile = fileUploads.liveSelfie;
      if (liveSelfieFile) {
        liveSelfieFile = await compressImage(liveSelfieFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      }

      let passbookImageFile = fileUploads.passbookImage;
      if (passbookImageFile) {
        passbookImageFile = await compressImage(passbookImageFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
      }

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
      profileData.currentAddress?.street, profileData.currentAddress?.villageCity, profileData.currentAddress?.state,
      profileData.currentAddress?.pincode, profileData.bankDetails.accountNo, profileData.bankDetails.ifsc,
      profileData.profilePicUrl, profileData.aadhaarFront, profileData.aadhaarBack, profileData.panCard, profileData.liveSelfie, profileData.bankDetails.passbookImage
    ];
    const completed = fields.filter(f => f && f !== false).length;
    return Math.round((completed / fields.length) * 100);
  };

  const formatServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Not added';
    return services.map(id => serviceMap[id] || id).join(', ') || 'Not added';
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  const completion = calculateProfileCompletion();

  const renderBackHeader = (title) => (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-100 xl:hidden">
      <button onClick={() => { setActiveTab('profile'); setEditMode({ basic: false, professional: false, address: false, bank: false }); }} className="p-1 rounded-full hover:bg-neutral-100 transition-colors">
        <ArrowLeft className="w-4.5 h-4.5 text-neutral-600" />
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
            
            {/* Profile Header View (Always visible on mobile tab list / desktop tab list) */}
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

                {/* Basic Information Card */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Basic Information</h3>
                    <button onClick={() => setEditMode({ ...editMode, basic: !editMode.basic })}
                      className={`text-[10px] font-bold text-primary hover:underline`}>
                      {editMode.basic ? 'Cancel' : 'Edit Info'}
                    </button>
                  </div>

                  {editMode.basic ? (
                    <form onSubmit={(e) => { e.preventDefault(); updateProfile('basic'); }} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">Full Name *</label>
                        <input type="text" name="name" value={profileData.name} onChange={(e) => handleChange(e)} required
                          className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">Email Address</label>
                        <div className="w-full px-3 py-2 text-xs font-bold border border-dashed border-neutral-200 rounded-xl bg-neutral-50 text-neutral-400 cursor-not-allowed flex items-center justify-between">
                          <span>{profileData.email}</span>
                          <span className="text-[9px] bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded font-black select-none">ReadOnly</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 mb-1">Phone Number</label>
                          <input type="tel" name="phone" value={profileData.phone} onChange={(e) => handleChange(e)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 mb-1">Birth Date</label>
                          <DatePicker selected={profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null}
                            onChange={(date) => {
                              const localDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                              setProfileData(prev => ({ ...prev, dateOfBirth: localDate }));
                            }}
                            dateFormat="yyyy-MM-dd" maxDate={new Date()}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                        </div>
                      </div>
                      <Processing
                        type="submit"
                        loading={isSaving}
                        loadingText="Saving..."
                        className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold"
                      >
                        Save Basic Info
                      </Processing>
                    </form>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-secondary">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Full Name</span>
                        <span>{profileData.name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Email</span>
                        <span>{profileData.email}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Phone</span>
                        <span>{profileData.phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Birth Date</span>
                        <span>{formatDate(profileData.dateOfBirth)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Professional Info Card */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Professional Info</h3>
                    <button onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
                      className={`text-[10px] font-bold text-primary hover:underline`}>
                      {editMode.professional ? 'Cancel' : 'Edit Professional'}
                    </button>
                  </div>

                  {editMode.professional ? (
                    <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">Services (Max 3)</label>
                        <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-xl border border-neutral-200 max-h-36 overflow-y-auto">
                          {providerServices.map(service => (
                            <label key={service.value} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-secondary">
                              <input type="checkbox" checked={(profileData.services || []).includes(service.value)}
                                onChange={() => handleServiceChange(service.value)}
                                disabled={(profileData.services || []).length >= 3 && !(profileData.services || []).includes(service.value)}
                                className="w-4 h-4 text-primary rounded" />
                              <span>{service.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold mt-1">Selected: {(profileData.services || []).length}/3</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 mb-1">Experience (Years)</label>
                          <input type="number" name="experience" value={profileData.experience || ''} onChange={(e) => handleChange(e)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 mb-1">Service Area</label>
                          <input type="text" name="serviceArea" value={profileData.serviceArea || ''} onChange={(e) => handleChange(e)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                        </div>
                      </div>
                      <Processing
                        type="submit"
                        loading={isSaving}
                        loadingText="Saving..."
                        className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
                      >
                        Save Professional Info
                      </Processing>
                    </form>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-secondary">
                      <div className="col-span-2">
                        <span className="text-neutral-400 block text-[10px]">Services</span>
                        <span>{formatServices(profileData.services)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Experience</span>
                        <span>{profileData.experience ? `${profileData.experience} Years` : '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Service Area</span>
                        <span>{profileData.serviceArea || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Saved Address Card */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Saved Address</h3>
                    <button onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
                      className={`text-[10px] font-bold text-primary hover:underline`}>
                      {editMode.address ? 'Cancel' : 'Edit Address'}
                    </button>
                  </div>

                  {editMode.address ? (
                    <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }} className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Current Address</h4>
                          <AddressSelector
                            address={{
                              houseNumber: profileData.currentAddress?.houseNumber || '',
                              road: profileData.currentAddress?.road || '',
                              landmark: profileData.currentAddress?.landmark || '',
                              area: profileData.currentAddress?.area || '',
                              city: profileData.currentAddress?.villageCity || profileData.currentAddress?.city || '',
                              state: profileData.currentAddress?.state || '',
                              pincode: profileData.currentAddress?.pincode || profileData.currentAddress?.postalCode || '',
                              postalCode: profileData.currentAddress?.pincode || profileData.currentAddress?.postalCode || '',
                              street: profileData.currentAddress?.street || '',
                              formattedAddress: profileData.currentAddress?.formattedAddress || '',
                              isManuallyEdited: profileData.currentAddress?.isManuallyEdited || false,
                            }}
                            onChange={(updatedAddress) => {
                              setProfileData((prev) => {
                                const mapped = {
                                  ...prev.currentAddress,
                                  houseNumber: updatedAddress.houseNumber || '',
                                  road: updatedAddress.road || '',
                                  landmark: updatedAddress.landmark || '',
                                  area: updatedAddress.area || '',
                                  city: updatedAddress.city || '',
                                  state: updatedAddress.state || '',
                                  pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                                  postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                                  street: updatedAddress.street || '',
                                  villageCity: updatedAddress.city || '',
                                  district: updatedAddress.area || '',
                                  formattedAddress: updatedAddress.formattedAddress || '',
                                  isManuallyEdited: updatedAddress.isManuallyEdited || false,
                                  lat: updatedAddress.lat !== undefined ? updatedAddress.lat : prev.currentAddress?.lat,
                                  lng: updatedAddress.lng !== undefined ? updatedAddress.lng : prev.currentAddress?.lng,
                                  s2CellId: updatedAddress.s2CellId || prev.currentAddress?.s2CellId,
                                  s2CellIdPrecise: updatedAddress.s2CellIdPrecise || prev.currentAddress?.s2CellIdPrecise,
                                };
                                const updated = {
                                  ...prev,
                                  currentAddress: mapped,
                                  address: {
                                    ...prev.address,
                                    street: mapped.street,
                                    city: mapped.villageCity,
                                    state: mapped.state,
                                    postalCode: mapped.pincode,
                                    lat: mapped.lat,
                                    lng: mapped.lng,
                                    s2CellId: mapped.s2CellId,
                                    s2CellIdPrecise: mapped.s2CellIdPrecise,
                                  }
                                };
                                if (prev.addressSame) {
                                  updated.permanentAddress = { ...mapped };
                                }
                                return updated;
                              });
                            }}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="profileAddressSame" checked={profileData.addressSame} onChange={(e) => {
                            const checked = e.target.checked;
                            setProfileData(prev => ({
                              ...prev,
                              addressSame: checked,
                              permanentAddress: checked ? { ...prev.currentAddress } : prev.permanentAddress
                            }));
                          }} className="w-4 h-4 rounded border-gray-300 text-primary" />
                          <label htmlFor="profileAddressSame" className="text-xs font-bold text-secondary">Permanent Address same as Current</label>
                        </div>

                        {!profileData.addressSame && (
                          <div>
                            <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Permanent Address</h4>
                            <AddressSelector
                              address={{
                                houseNumber: profileData.permanentAddress?.houseNumber || '',
                                road: profileData.permanentAddress?.road || '',
                                landmark: profileData.permanentAddress?.landmark || '',
                                area: profileData.permanentAddress?.area || '',
                                city: profileData.permanentAddress?.villageCity || profileData.permanentAddress?.city || '',
                                state: profileData.permanentAddress?.state || '',
                                pincode: profileData.permanentAddress?.pincode || profileData.permanentAddress?.postalCode || '',
                                postalCode: profileData.permanentAddress?.pincode || profileData.permanentAddress?.postalCode || '',
                                street: profileData.permanentAddress?.street || '',
                                formattedAddress: profileData.permanentAddress?.formattedAddress || '',
                                isManuallyEdited: profileData.permanentAddress?.isManuallyEdited || false,
                              }}
                              onChange={(updatedAddress) => {
                                setProfileData((prev) => ({
                                  ...prev,
                                  permanentAddress: {
                                    ...prev.permanentAddress,
                                    houseNumber: updatedAddress.houseNumber || '',
                                    road: updatedAddress.road || '',
                                    landmark: updatedAddress.landmark || '',
                                    area: updatedAddress.area || '',
                                    city: updatedAddress.city || '',
                                    state: updatedAddress.state || '',
                                    pincode: updatedAddress.pincode || updatedAddress.postalCode || '',
                                    postalCode: updatedAddress.postalCode || updatedAddress.pincode || '',
                                    street: updatedAddress.street || '',
                                    villageCity: updatedAddress.city || '',
                                    district: updatedAddress.area || '',
                                    formattedAddress: updatedAddress.formattedAddress || '',
                                    isManuallyEdited: updatedAddress.isManuallyEdited || false,
                                    lat: updatedAddress.lat !== undefined ? updatedAddress.lat : prev.permanentAddress?.lat,
                                    lng: updatedAddress.lng !== undefined ? updatedAddress.lng : prev.permanentAddress?.lng,
                                    s2CellId: updatedAddress.s2CellId || prev.permanentAddress?.s2CellId,
                                    s2CellIdPrecise: updatedAddress.s2CellIdPrecise || prev.permanentAddress?.s2CellIdPrecise,
                                  }
                                }));
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mt-4">Location Coordinates (Map Selector)</h4>
                      <AddressSelector
                        address={profileData.address}
                        onChange={(updatedAddress) => setProfileData(prev => ({
                          ...prev,
                          address: updatedAddress,
                          serviceArea: updatedAddress.city || prev.serviceArea
                        }))}
                      />
                      <Processing
                        type="submit"
                        loading={isSaving}
                        loadingText="Saving..."
                        className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
                      >
                        Save Address Details
                      </Processing>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2.5 text-left">
                        <MapPin className="w-4.5 h-4.5 text-neutral-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-neutral-400 block text-[10px] font-black uppercase tracking-wider">Current Address</span>
                          {profileData.currentAddress?.street || profileData.currentAddress?.villageCity ? (
                            <p className="text-xs font-bold text-secondary leading-normal">
                              {`${profileData.currentAddress.houseNumber || ''}, ${profileData.currentAddress.street || ''}, ${profileData.currentAddress.landmark || ''}, ${profileData.currentAddress.villageCity || ''}, ${profileData.currentAddress.district || ''}, ${profileData.currentAddress.state || ''} - ${profileData.currentAddress.pincode || ''}`}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-400 font-bold italic">No current address added yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 text-left">
                        <MapPin className="w-4.5 h-4.5 text-neutral-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-neutral-400 block text-[10px] font-black uppercase tracking-wider">Permanent Address</span>
                          {profileData.addressSame ? (
                            <p className="text-xs font-bold text-secondary leading-normal italic">Same as Current Address</p>
                          ) : (profileData.permanentAddress?.street || profileData.permanentAddress?.villageCity) ? (
                            <p className="text-xs font-bold text-secondary leading-normal">
                              {`${profileData.permanentAddress.houseNumber || ''}, ${profileData.permanentAddress.street || ''}, ${profileData.permanentAddress.landmark || ''}, ${profileData.permanentAddress.villageCity || ''}, ${profileData.permanentAddress.district || ''}, ${profileData.permanentAddress.state || ''} - ${profileData.permanentAddress.pincode || ''}`}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-400 font-bold italic">No permanent address added yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 text-left">
                        <MapPin className="w-4.5 h-4.5 text-neutral-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-neutral-400 block text-[10px] font-black uppercase tracking-wider">Map Coordinates Location</span>
                          {profileData.address?.street || profileData.address?.city ? (
                            <p className="text-xs font-bold text-secondary leading-normal">
                              {profileData.address.formattedAddress || profileData.address.street}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-400 font-bold italic">No coordinates set yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bank Account Details Card */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Bank Account Details</h3>
                    <button onClick={() => setEditMode({ ...editMode, bank: !editMode.bank })}
                      className={`text-[10px] font-bold text-primary hover:underline`}>
                      {editMode.bank ? 'Cancel' : 'Edit Bank'}
                    </button>
                  </div>

                  {editMode.bank ? (
                    <form onSubmit={(e) => { e.preventDefault(); if (isBankValid) { updateProfile('bank'); } }} className="space-y-4 text-left">
                      <IfscBankDetails
                        value={{
                          ifsc: profileData.bankDetails.ifsc,
                          accountNo: profileData.bankDetails.accountNo,
                          bankName: profileData.bankDetails.bankName,
                          branch: profileData.bankDetails.branch,
                          district: profileData.bankDetails.district,
                          state: profileData.bankDetails.state,
                          city: profileData.bankDetails.city,
                          address: profileData.bankDetails.address,
                        }}
                        onChange={(updated) => {
                          setProfileData((prev) => ({
                            ...prev,
                            bankDetails: {
                              ...prev.bankDetails,
                              ifsc: updated.ifsc || '',
                              accountNo: updated.accountNo || '',
                              bankName: updated.bankName || '',
                              branch: updated.branch || '',
                              district: updated.district || '',
                              state: updated.state || '',
                              city: updated.city || '',
                              address: updated.address || '',
                            }
                          }));
                        }}
                        onValidityChange={setIsBankValid}
                        showAccountName={true}
                        accountNameValue={profileData.bankDetails.accountName || ''}
                        onAccountNameChange={(name) => {
                          setProfileData((prev) => ({
                            ...prev,
                            bankDetails: {
                              ...prev.bankDetails,
                              accountName: name,
                            }
                          }));
                        }}
                      />
                      <Processing
                        type="submit"
                        loading={isSaving}
                        disabled={!isBankValid || isSaving}
                        loadingText="Saving..."
                        className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Save Bank Details
                      </Processing>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold text-secondary">
                        <div>
                          <span className="text-neutral-400 block text-[10px]">Holder Name</span>
                          <span>{profileData.bankDetails.accountName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">Bank Name</span>
                          <span>{profileData.bankDetails.bankName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">Account Number</span>
                          <span>{profileData.bankDetails.accountNo || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px]">IFSC Code</span>
                          <span>{profileData.bankDetails.ifsc || '—'}</span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Verification Status</span>
                        <span className={`inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.bankDetails.verified ? 'bg-success/15 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
                          {profileData.bankDetails.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete Account Card */}
                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-left">
                  <div>
                    <p className="text-xs font-black text-rose-800 uppercase tracking-wide">Delete Account</p>
                    <p className="text-[10px] text-rose-600 font-bold mt-1">Permanently delete your account and all professional data from the platform.</p>
                  </div>
                  <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: true })} className="w-full sm:w-auto bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-700 transition-colors shadow-sm select-none">
                    Delete Account
                  </button>
                </div>
              </>
            )}

            {/* Overview Details View */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {renderBackHeader('Overview Details')}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Account Details */}
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm text-left">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Account Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Provider ID</span>
                        <span className="text-primary">{profileData.providerId || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Member Since</span>
                        <span>{formatDate(profileData.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Test Status</span>
                        <span className={`inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded ${profileData.testPassed ? 'bg-success/15 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
                          {profileData.testPassed ? 'Qualified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Service Info */}
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm text-left">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Service Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Services</span>
                        <span className="truncate max-w-[120px]">{formatServices(profileData.services)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Experience</span>
                        <span>{profileData.experience ? `${profileData.experience} Years` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Total Reviews</span>
                        <span>{profileData.ratingCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Details */}
                  <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm text-left">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Wallet Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Available Balance</span>
                        <span className="text-success">{formatCurrency(profileData.wallet?.availableBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-50 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Total Withdrawn</span>
                        <span>{formatCurrency(profileData.wallet?.totalWithdrawn || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 text-xs font-bold text-secondary">
                        <span className="text-neutral-400">Last Update</span>
                        <span>{formatDate(profileData.wallet?.lastUpdated)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {profileData.blockedTill && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
                    <p className="text-xs font-bold text-rose-800"><span className="font-black">🔒 Account Blocked</span> until {formatDate(profileData.blockedTill)}</p>
                  </div>
                )}
                {profileData.kycStatus === 'rejected' && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
                    <p className="text-xs font-black text-rose-800">⚠️ KYC Rejected</p>
                    <p className="text-xs text-rose-700 font-bold mt-1">{profileData.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Documents View */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                {renderBackHeader('Uploaded Documents')}

                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden text-left">
                  <div className="px-4 py-3 bg-neutral-50/50 flex items-center justify-between border-b border-neutral-100">
                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-sans">Verification Documents</h3>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {/* Row 1: Profile Photo */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Profile Photo</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Provide a clear selfie or passport sized photo.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.profilePicUrl ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                          {profileData.profilePicUrl ? '✓ Stored' : '✗ Required'}
                        </span>
                        <div className="flex items-center gap-2">
                          <input id="profilePicUpload" type="file" onChange={(e) => handleFileChange(e, 'profilePic')} accept="image/*" className="hidden" />
                          <label htmlFor="profilePicUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                            <Upload className="w-3.5 h-3.5 inline mr-1" /> Change
                          </label>
                          {fileUploads.profilePic && (
                            <Processing
                              onClick={() => updateProfile('profilePic')}
                              loading={isSaving}
                              loadingText="Uploading..."
                              className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                            >
                              Upload
                            </Processing>
                          )}
                          {profileData.profilePicUrl && (
                            <button onClick={() => viewDocument('profile')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Aadhaar Front */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Aadhaar Front</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Upload the front page of your Aadhaar card.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.aadhaarFront ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                          {profileData.aadhaarFront ? '✓ Verified Front' : '✗ Required'}
                        </span>
                        <div className="flex items-center gap-2">
                          {!profileData.approved ? (
                            <>
                              <input id="aadhaarFrontUpload" type="file" onChange={(e) => handleFileChange(e, 'aadhaarFront')} accept="image/*" className="hidden" />
                              <label htmlFor="aadhaarFrontUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                              </label>
                              {fileUploads.aadhaarFront && (
                                <Processing
                                  onClick={() => updateProfile('aadhaarFront')}
                                  loading={isSaving}
                                  loadingText="Submitting..."
                                  className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                                >
                                  Submit
                                </Processing>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] text-neutral-400 font-bold italic">Read-only (Approved)</span>
                          )}
                          {profileData.aadhaarFront && (
                            <button onClick={() => viewDocument('aadhaarFront')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Aadhaar Back */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Aadhaar Back</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Upload the back page of your Aadhaar card.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.aadhaarBack ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                          {profileData.aadhaarBack ? '✓ Verified Back' : '✗ Required'}
                        </span>
                        <div className="flex items-center gap-2">
                          {!profileData.approved ? (
                            <>
                              <input id="aadhaarBackUpload" type="file" onChange={(e) => handleFileChange(e, 'aadhaarBack')} accept="image/*" className="hidden" />
                              <label htmlFor="aadhaarBackUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                              </label>
                              {fileUploads.aadhaarBack && (
                                <Processing
                                  onClick={() => updateProfile('aadhaarBack')}
                                  loading={isSaving}
                                  loadingText="Submitting..."
                                  className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                                >
                                  Submit
                                </Processing>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] text-neutral-400 font-bold italic">Read-only (Approved)</span>
                          )}
                          {profileData.aadhaarBack && (
                            <button onClick={() => viewDocument('aadhaarBack')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: PAN Card */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">PAN Card</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Upload front copy of your permanent account card.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.panCard ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                          {profileData.panCard ? '✓ Verified PAN' : '✗ Required'}
                        </span>
                        <div className="flex items-center gap-2">
                          {!profileData.approved ? (
                            <>
                              <input id="panCardUpload" type="file" onChange={(e) => handleFileChange(e, 'panCard')} accept="image/*" className="hidden" />
                              <label htmlFor="panCardUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                              </label>
                              {fileUploads.panCard && (
                                <Processing
                                  onClick={() => updateProfile('panCard')}
                                  loading={isSaving}
                                  loadingText="Submitting..."
                                  className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                                >
                                  Submit
                                </Processing>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] text-neutral-400 font-bold italic">Read-only (Approved)</span>
                          )}
                          {profileData.panCard && (
                            <button onClick={() => viewDocument('panCard')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Live Selfie */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Live Selfie</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Upload a recent photo holding Aadhaar or ID card.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.liveSelfie ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                          {profileData.liveSelfie ? '✓ Verified Selfie' : '✗ Required'}
                        </span>
                        <div className="flex items-center gap-2">
                          {!profileData.approved ? (
                            <>
                              <input id="liveSelfieUpload" type="file" onChange={(e) => handleFileChange(e, 'liveSelfie')} accept="image/*" className="hidden" />
                              <label htmlFor="liveSelfieUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                              </label>
                              {fileUploads.liveSelfie && (
                                <Processing
                                  onClick={() => updateProfile('liveSelfie')}
                                  loading={isSaving}
                                  loadingText="Submitting..."
                                  className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                                >
                                  Submit
                                </Processing>
                              )}
                            </>
                          ) : (
                            <span className="text-[9px] text-neutral-450 font-bold italic">Read-only (Approved)</span>
                          )}
                          {profileData.liveSelfie && (
                            <button onClick={() => viewDocument('liveSelfie')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 6: Bank Passbook */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Bank Passbook</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Upload photocopy of passbook or cancelled cheque.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded select-none ${profileData.bankDetails.passbookImage ? 'bg-success/15 text-emerald-700' : 'bg-rose-50 text-rose-500'}`}>
                            {profileData.bankDetails.passbookImage ? '✓ Stored' : '✗ Required'}
                          </span>
                          {profileData.bankDetails.verified && (
                            <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded select-none">✓ Verified</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input id="passbookUpload" type="file" onChange={(e) => handleFileChange(e, 'passbookImage')} accept="image/*" className="hidden" />
                          <label htmlFor="passbookUpload" className="px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black text-secondary cursor-pointer select-none">
                            <Upload className="w-3.5 h-3.5 inline mr-1" /> Change
                          </label>
                          {fileUploads.passbookImage && (
                            <Processing
                              onClick={() => updateProfile('bank')}
                              loading={isSaving}
                              loadingText="Uploading..."
                              className="px-3 py-1.5 bg-accent text-white rounded-xl text-[10px] font-black shadow-sm select-none"
                            >
                              Upload
                            </Processing>
                          )}
                          {profileData.bankDetails.passbookImage && (
                            <button onClick={() => viewDocument('passbook')} className="px-3 py-1.5 bg-secondary text-white rounded-xl text-[10px] font-black select-none">
                              <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 7: Provider Service Agreement */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-secondary">Provider Service Agreement</h4>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">This contains your signed legal declarations, accepted terms, and digitized signature logs.</p>
                      </div>
                      <div className="shrink-0">
                        {profileData.legalAcceptance?.agreementAccepted ? (
                          <a
                            href={`${API}/provider/agreement-pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1.5 bg-primary text-white rounded-xl text-[10px] font-bold select-none text-center"
                          >
                            Download Agreement PDF
                          </a>
                        ) : (
                          <button disabled className="px-3 py-1.5 bg-neutral-100 text-neutral-450 rounded-xl text-[10px] font-bold cursor-not-allowed select-none">
                            No Active Agreement
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings View */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                {renderBackHeader('Notification Settings')}

                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between mb-4 border-b border-neutral-50 pb-3">
                    <div>
                      <h3 className="text-xs font-black text-secondary uppercase tracking-widest">Notification Settings</h3>
                      <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Customize alerts for new bookings and requests</p>
                    </div>
                    <Bell className="w-5 h-5 text-primary" />
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); updateProfile('settings'); }} className="space-y-5">
                    {/* Enable Tone Switch */}
                    <div className="flex items-center justify-between py-2 border-b border-neutral-50 opacity-90">
                      <div>
                        <label className="text-xs font-bold text-secondary">Enable Alert Tone (Always Enabled)</label>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Play a ringtone when a new booking is assigned or offered</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-primary rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[18px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                      </label>
                    </div>

                    {/* Enable Vibration Switch */}
                    <div className="flex items-center justify-between py-2 border-b border-neutral-50">
                      <div>
                        <label className="text-xs font-bold text-secondary">Enable Vibration</label>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Vibrate device on receiving booking alerts</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileData.notificationPreferences && profileData.notificationPreferences.bookingVibration !== false}
                          onChange={(e) => handlePreferenceChange('bookingVibration', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {/* Repeat Alert Tone Switch */}
                    <div className="flex items-center justify-between py-2 border-b border-neutral-50 opacity-90">
                      <div>
                        <label className="text-xs font-bold text-secondary">Repeat Alert Tone (Always Enabled)</label>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Continuously loop the ringtone until booking is accepted, rejected or expired</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-primary rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[18px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                      </label>
                    </div>

                    {/* Tone Duration Dropdown */}
                    <div className="py-2">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">Alert Ringing Duration</label>
                      <select
                        value={(profileData.notificationPreferences && profileData.notificationPreferences.bookingAlertDuration) || 30}
                        onChange={(e) => handlePreferenceChange('bookingAlertDuration', Number(e.target.value))}
                        className="w-full sm:w-auto px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      >
                        <option value={5}>5 Seconds</option>
                        <option value={10}>10 Seconds</option>
                        <option value={15}>15 Seconds</option>
                        <option value={30}>30 Seconds</option>
                        <option value={45}>45 Seconds</option>
                        <option value={60}>60 Seconds (Max)</option>
                      </select>
                      <p className="text-[10px] text-neutral-400 font-bold mt-1.5">Ringtone will automatically stop playing after this duration</p>
                    </div>

                    <Processing
                      type="submit"
                      loading={isSaving}
                      loadingText="Saving Preferences..."
                      className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold"
                    >
                      Save Notification Preferences
                    </Processing>
                  </form>
                </div>
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${deleteModal.confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProviderProfile;