import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-toastify/dist/ReactToastify.css';
import { Loader2, AlertCircle, Edit2, X, Check, Upload, Eye, Camera, FileText, CreditCard, Bell, Shield, Package, Wallet, User, MapPin, ArrowLeft, ChevronRight, Star } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('overview');
  const [documentModal, setDocumentModal] = useState({ isOpen: false, type: null, url: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, confirmed: false });
  const [isSaving, setIsSaving] = useState(false);


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

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-secondary font-poppins">My Profile</h1>
              <p className="text-xs text-gray-400">Manage your professional account</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block space-y-3 font-poppins">
            <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm">
              {[
                { id: 'overview', label: 'Overview', icon: <Package className="w-4 h-4" /> },
                { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
                { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
                { id: 'settings', label: 'Settings', icon: <Bell className="w-4 h-4" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setEditMode({ basic: false, professional: false, address: false, bank: false }); }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all group mt-1 first:mt-0 ${activeTab === item.id
                    ? 'bg-primary/5 text-primary'
                    : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`transition-colors ${activeTab === item.id ? 'text-primary' : 'text-gray-400 group-hover:text-secondary'}`}>
                      {item.icon}
                    </div>
                    <span className={`text-sm font-semibold tracking-tight ${activeTab === item.id ? 'text-primary' : 'text-gray-600 group-hover:text-secondary'}`}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === item.id ? 'opacity-100 translate-x-1' : 'opacity-0'}`} />
                </button>
              ))}
            </div>

            {/* Stats Card */}
            <div className="bg-gradient-to-br from-secondary to-gray-800 rounded-xl p-4 text-white">
              <p className="text-[10px] font-semibold uppercase text-white/50 mb-3 text-center">Account Stats</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><span className="text-xs font-semibold">Completed</span></div>
                  <span className="text-sm font-bold">{profileData.completedBookings || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><X className="w-4 h-4 text-accent" /><span className="text-xs font-semibold">Cancelled</span></div>
                  <span className="text-sm font-bold">{profileData.canceledBookings || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /><span className="text-xs font-semibold">Rating</span></div>
                  <span className="text-sm font-bold">{profileData.averageRating || '0'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-5">
            {/* Profile Header Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-primary/10 to-primary/5"></div>
              <div className="px-5 pb-5 relative">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-10">
                  {/* Avatar */}
                  <div className="relative">
                    <img
                      src={profileData.profilePicUrl || `https://ui-avatars.com/api/?name=${profileData.name || 'Provider'}&background=0D9488&color=fff`}
                      alt={profileData.name}
                      className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover bg-white"
                    />
                    <label className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 cursor-pointer shadow-md hover:bg-primary/90">
                      <Camera className="w-3.5 h-3.5 text-white" />
                      <input type="file" onChange={(e) => handleFileChange(e, 'profilePic')} accept="image/*" className="hidden" />
                    </label>
                    {fileUploads.profilePic && (
                      <button onClick={() => updateProfile('profilePic')} className="absolute -top-2 -right-2 bg-accent text-white p-1 rounded-full shadow-md">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h2 className="text-xl font-bold text-secondary">{profileData.name || 'Provider'}</h2>
                      <div className="flex gap-1.5 ml-2">
                        {profileData.isActive && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">Active</span>}
                        {profileData.approved && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full">Approved</span>}
                        {profileData.kycStatus === 'approved' && <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-full">KYC Verified</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-gray-400">
                      <span className="font-semibold text-primary">ID: {profileData.providerId || 'N/A'}</span>
                      <span className="hidden sm:block">•</span>
                      <span>{profileData.email}</span>
                      <span className="hidden sm:block">•</span>
                      <span>{profileData.phone || 'No Phone'}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile Quick Links - Only visible on small screens */}
                <div className="grid grid-cols-4 gap-2 mt-6 lg:hidden border-t border-gray-50 pt-4">
                  {[
                    { id: 'overview', label: 'Overview', icon: <Package className="w-4 h-4 text-primary" /> },
                    { id: 'documents', label: 'Docs', icon: <FileText className="w-4 h-4 text-rose-500" /> },
                    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4 text-accent" /> },
                    { id: 'settings', label: 'Settings', icon: <Bell className="w-4 h-4 text-teal-600" /> },
                  ].map((link, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setActiveTab(link.id); setEditMode({ basic: false, professional: false, address: false, bank: false }); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${activeTab === link.id ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      {link.icon}
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{link.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Completion */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Profile Completion</span>
                <span className="text-sm font-bold text-primary">{completion}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${completion}%` }} />
              </div>
            </div>

            {/* Tab Contents */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Account Details */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Account Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Provider ID</span>
                          <span className="text-xs font-bold text-primary">{profileData.providerId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Member Since</span>
                          <span className="text-xs font-bold text-secondary">
                            {formatDate(profileData.createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Test Status</span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${profileData.testPassed ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                            {profileData.testPassed ? 'Qualified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Service Info */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Service Information</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Services</span>
                          <span className="text-xs font-bold text-secondary text-right truncate max-w-[120px]">{formatServices(profileData.services)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Experience</span>
                          <span className="text-xs font-bold text-primary">
                            {profileData.experience ? `${profileData.experience} Years` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Total Reviews</span>
                          <span className="text-xs font-bold text-secondary">{profileData.ratingCount || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Wallet Details */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Wallet Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/10 rounded-xl">
                          <span className="text-xs text-primary font-bold">Available</span>
                          <span className="text-sm font-bold text-secondary">{formatCurrency(profileData.wallet?.availableBalance || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Withdrawn</span>
                          <span className="text-xs font-bold text-secondary">{formatCurrency(profileData.wallet?.totalWithdrawn || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                          <span className="text-xs text-gray-400 font-semibold">Last Update</span>
                          <span className="text-xs font-bold text-secondary text-right">
                            {formatDate(profileData.wallet?.lastUpdated)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {profileData.blockedTill && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-700 font-medium"><span className="font-bold">🔒 Account Blocked</span> until {formatDate(profileData.blockedTill)}</p>
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
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Profile Photo</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.profilePicUrl ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                      {profileData.profilePicUrl ? '✓ Stored' : '✗ Required'}
                    </span>
                    <div className="space-y-2">
                      <input id="profilePicUpload" type="file" onChange={(e) => handleFileChange(e, 'profilePic')} accept="image/*" className="hidden" />
                      <label htmlFor="profilePicUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                        <Upload className="w-3.5 h-3.5 inline mr-2" /> Change Photo
                      </label>
                      {fileUploads.profilePic && (
                        <Processing
                          onClick={() => updateProfile('profilePic')}
                          loading={isSaving}
                          loadingText="Uploading..."
                          icon={<Check className="w-3.5 h-3.5" />}
                          className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                        >
                          Upload Now
                        </Processing>
                      )}
                      {profileData.profilePicUrl && (
                        <button onClick={() => viewDocument('profile')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Current
                        </button>
                      )}
                    </div>
                  </div>

                   {/* Aadhaar Front */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Aadhaar Front</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.aadhaarFront ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                      {profileData.aadhaarFront ? '✓ Verified Front' : '✗ Required'}
                    </span>
                    <div className="space-y-2">
                      {!profileData.approved ? (
                        <>
                          <input id="aadhaarFrontUpload" type="file" onChange={(e) => handleFileChange(e, 'aadhaarFront')} accept="image/*" className="hidden" />
                          <label htmlFor="aadhaarFrontUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                            <Upload className="w-3.5 h-3.5 inline mr-2" /> Upload Front
                          </label>
                          {fileUploads.aadhaarFront && (
                            <Processing
                              onClick={() => updateProfile('aadhaarFront')}
                              loading={isSaving}
                              loadingText="Submitting..."
                              icon={<Check className="w-3.5 h-3.5" />}
                              className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                            >
                              Submit Front
                            </Processing>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-semibold italic mb-2">Read-only (Approved)</p>
                      )}
                      {profileData.aadhaarFront && (
                        <button onClick={() => viewDocument('aadhaarFront')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Front
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Aadhaar Back */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Aadhaar Back</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.aadhaarBack ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                      {profileData.aadhaarBack ? '✓ Verified Back' : '✗ Required'}
                    </span>
                    <div className="space-y-2">
                      {!profileData.approved ? (
                        <>
                          <input id="aadhaarBackUpload" type="file" onChange={(e) => handleFileChange(e, 'aadhaarBack')} accept="image/*" className="hidden" />
                          <label htmlFor="aadhaarBackUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                            <Upload className="w-3.5 h-3.5 inline mr-2" /> Upload Back
                          </label>
                          {fileUploads.aadhaarBack && (
                            <Processing
                              onClick={() => updateProfile('aadhaarBack')}
                              loading={isSaving}
                              loadingText="Submitting..."
                              icon={<Check className="w-3.5 h-3.5" />}
                              className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                            >
                              Submit Back
                            </Processing>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-semibold italic mb-2">Read-only (Approved)</p>
                      )}
                      {profileData.aadhaarBack && (
                        <button onClick={() => viewDocument('aadhaarBack')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Back
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PAN Card */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">PAN Card</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.panCard ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                      {profileData.panCard ? '✓ Verified PAN' : '✗ Required'}
                    </span>
                    <div className="space-y-2">
                      {!profileData.approved ? (
                        <>
                          <input id="panCardUpload" type="file" onChange={(e) => handleFileChange(e, 'panCard')} accept="image/*" className="hidden" />
                          <label htmlFor="panCardUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                            <Upload className="w-3.5 h-3.5 inline mr-2" /> Upload PAN
                          </label>
                          {fileUploads.panCard && (
                            <Processing
                              onClick={() => updateProfile('panCard')}
                              loading={isSaving}
                              loadingText="Submitting..."
                              icon={<Check className="w-3.5 h-3.5" />}
                              className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                            >
                              Submit PAN
                            </Processing>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-semibold italic mb-2">Read-only (Approved)</p>
                      )}
                      {profileData.panCard && (
                        <button onClick={() => viewDocument('panCard')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View PAN
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Selfie */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Live Selfie</h4>
                    <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full mb-4 ${profileData.liveSelfie ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                      {profileData.liveSelfie ? '✓ Verified Selfie' : '✗ Required'}
                    </span>
                    <div className="space-y-2">
                      {!profileData.approved ? (
                        <>
                          <input id="liveSelfieUpload" type="file" onChange={(e) => handleFileChange(e, 'liveSelfie')} accept="image/*" className="hidden" />
                          <label htmlFor="liveSelfieUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                            <Upload className="w-3.5 h-3.5 inline mr-2" /> Upload Selfie
                          </label>
                          {fileUploads.liveSelfie && (
                            <Processing
                              onClick={() => updateProfile('liveSelfie')}
                              loading={isSaving}
                              loadingText="Submitting..."
                              icon={<Check className="w-3.5 h-3.5" />}
                              className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                            >
                              Submit Selfie
                            </Processing>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400 font-semibold italic mb-2">Read-only (Approved)</p>
                      )}
                      {profileData.liveSelfie && (
                        <button onClick={() => viewDocument('liveSelfie')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Selfie
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Passbook */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Bank Passbook</h4>
                    <div className="flex flex-col gap-1 items-center mb-4">
                      <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full ${profileData.bankDetails.passbookImage ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                        {profileData.bankDetails.passbookImage ? '✓ Stored' : '✗ Required'}
                      </span>
                      {profileData.bankDetails.verified && (
                        <span className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-tighter rounded-full bg-blue-50 text-blue-600">✓ Bank Verified</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input id="passbookUpload" type="file" onChange={(e) => handleFileChange(e, 'passbookImage')} accept="image/*" className="hidden" />
                      <label htmlFor="passbookUpload" className="block w-full px-4 py-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs font-bold text-secondary hover:border-primary transition-all cursor-pointer">
                        <Upload className="w-3.5 h-3.5 inline mr-2" /> Change File
                      </label>
                      {fileUploads.passbookImage && (
                        <Processing
                          onClick={() => updateProfile('bank')}
                          loading={isSaving}
                          loadingText="Uploading..."
                          icon={<Check className="w-3.5 h-3.5" />}
                          className="block w-full py-2 bg-accent text-white rounded-lg text-xs font-black shadow-sm"
                        >
                          Upload Now
                        </Processing>
                      )}
                      {profileData.bankDetails.passbookImage && (
                        <button onClick={() => viewDocument('passbook')} className="block w-full px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                          <Eye className="w-3.5 h-3.5 inline mr-2" /> View Current
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Provider Agreement PDF */}
                  <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm relative group col-span-1 md:col-span-3">
                    <div className="w-12 h-12 mx-auto bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-secondary text-sm mb-2">Provider Service Agreement</h4>
                    <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">This contains your signed legal declarations, accepted terms, and digitized signature logs.</p>
                    <div className="max-w-xs mx-auto">
                      {profileData.legalAcceptance?.agreementAccepted ? (
                        <a
                          href={`${API}/provider/agreement-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all text-center shadow-sm"
                        >
                          View & Download Agreement PDF
                        </a>
                      ) : (
                        <button disabled className="block w-full px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-bold cursor-not-allowed">
                          No Active Agreement
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
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Basic Information</h3>
                        <button onClick={() => setEditMode({ ...editMode, basic: !editMode.basic })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${editMode.basic ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'}`}>
                          {editMode.basic ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                          {editMode.basic ? 'Cancel' : 'Edit'}
                        </button>
                      </div>

                      {editMode.basic ? (
                        <form onSubmit={(e) => { e.preventDefault(); updateProfile('basic'); }} className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
                            <input type="text" name="name" value={profileData.name} onChange={(e) => handleChange(e)} required
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Email Address</label>
                            <div className="w-full px-3 py-2 text-sm border border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed flex items-center gap-2">
                              {profileData.email}
                              <span className="ml-auto text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">Cannot change</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone Number</label>
                              <input type="tel" name="phone" value={profileData.phone} onChange={(e) => handleChange(e)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Birth Date</label>
                              <DatePicker selected={profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null}
                                onChange={(date) => {
                                  const localDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                                  setProfileData(prev => ({ ...prev, dateOfBirth: localDate }));
                                }}
                                dateFormat="yyyy-MM-dd" maxDate={new Date()}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                          </div>
                          <Processing
                            type="submit"
                            loading={isSaving}
                            loadingText="Saving..."
                            className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                          >
                            Save Changes
                          </Processing>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><p className="text-xs text-gray-400 mb-1">Full Name</p><p className="text-sm font-medium text-secondary">{profileData.name || '—'}</p></div>
                            <div><p className="text-xs text-gray-400 mb-1">Email</p><p className="text-sm font-medium text-secondary">{profileData.email}</p></div>
                            <div><p className="text-xs text-gray-400 mb-1">Phone</p><p className="text-sm font-medium text-secondary">{profileData.phone || '—'}</p></div>
                            <div><p className="text-xs text-gray-400 mb-1">Birth Date</p><p className="text-sm font-medium text-secondary">{formatDate(profileData.dateOfBirth)}</p></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Professional Info */}
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Professional Info</h3>
                        <button onClick={() => setEditMode({ ...editMode, professional: !editMode.professional })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${editMode.professional ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'}`}>
                          {editMode.professional ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                          {editMode.professional ? 'Cancel' : 'Edit'}
                        </button>
                      </div>

                      {editMode.professional ? (
                        <form onSubmit={(e) => { e.preventDefault(); updateProfile('professional'); }} className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Services (Max 3)</label>
                            <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-lg border border-gray-200 max-h-36 overflow-y-auto">
                              {providerServices.map(service => (
                                <label key={service.value} className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={(profileData.services || []).includes(service.value)}
                                    onChange={() => handleServiceChange(service.value)}
                                    disabled={(profileData.services || []).length >= 3 && !(profileData.services || []).includes(service.value)}
                                    className="w-4 h-4 text-primary rounded" />
                                  <span className="text-xs text-gray-700">{service.label}</span>
                                </label>
                              ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Selected: {(profileData.services || []).length}/3</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Experience (Years)</label>
                              <input type="number" name="experience" value={profileData.experience || ''} onChange={(e) => handleChange(e)}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Service Area</label>
                              <input type="text" name="serviceArea" value={profileData.serviceArea || ''} onChange={(e) => handleChange(e)}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                          </div>
                          <Processing
                            type="submit"
                            loading={isSaving}
                            loadingText="Saving..."
                            className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                          >
                            Save Professional Info
                          </Processing>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="col-span-2"><p className="text-xs text-gray-400 mb-1">Services</p><p className="text-sm font-medium text-secondary">{formatServices(profileData.services)}</p></div>
                            <div><p className="text-xs text-gray-400 mb-1">Experience</p><p className="text-sm font-medium text-secondary">{profileData.experience ? `${profileData.experience} Years` : '—'}</p></div>
                            <div><p className="text-xs text-gray-400 mb-1">Service Area</p><p className="text-sm font-medium text-secondary">{profileData.serviceArea || '—'}</p></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saved Address</h3>
                      <button onClick={() => setEditMode({ ...editMode, address: !editMode.address })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${editMode.address ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'}`}>
                        {editMode.address ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        {editMode.address ? 'Cancel' : 'Edit Address'}
                      </button>
                    </div>

                    {editMode.address ? (
                      <form onSubmit={(e) => { e.preventDefault(); updateProfile('address'); }} className="space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Address</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">House Number *</label>
                              <input type="text" value={profileData.currentAddress?.houseNumber || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, houseNumber: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Street *</label>
                              <input type="text" value={profileData.currentAddress?.street || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, street: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Landmark *</label>
                              <input type="text" value={profileData.currentAddress?.landmark || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, landmark: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Village/City *</label>
                              <input type="text" value={profileData.currentAddress?.villageCity || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, villageCity: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">District *</label>
                              <input type="text" value={profileData.currentAddress?.district || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, district: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">State *</label>
                              <input type="text" value={profileData.currentAddress?.state || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, state: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Pincode *</label>
                              <input type="text" value={profileData.currentAddress?.pincode || ''} onChange={(e) => setProfileData(prev => {
                                const updatedAddr = { ...prev.currentAddress, pincode: e.target.value };
                                return {
                                  ...prev,
                                  currentAddress: updatedAddr,
                                  permanentAddress: prev.addressSame ? { ...updatedAddr } : prev.permanentAddress
                                };
                              })} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                            </div>
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
                            <label htmlFor="profileAddressSame" className="text-xs font-bold text-secondary">Permanent Address same as Current Address</label>
                          </div>
 
                          {!profileData.addressSame && (
                            <>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4">Permanent Address</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">House Number *</label>
                                  <input type="text" value={profileData.permanentAddress?.houseNumber || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, houseNumber: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Street *</label>
                                  <input type="text" value={profileData.permanentAddress?.street || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, street: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Landmark *</label>
                                  <input type="text" value={profileData.permanentAddress?.landmark || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, landmark: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Village/City *</label>
                                  <input type="text" value={profileData.permanentAddress?.villageCity || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, villageCity: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">District *</label>
                                  <input type="text" value={profileData.permanentAddress?.district || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, district: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">State *</label>
                                  <input type="text" value={profileData.permanentAddress?.state || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, state: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Pincode *</label>
                                  <input type="text" value={profileData.permanentAddress?.pincode || ''} onChange={(e) => setProfileData(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, pincode: e.target.value } }))} required className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
 
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4">Location Coordinates (Map Selector)</h4>
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
                          className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                        >
                          Save Address Details
                        </Processing>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="w-5 h-5 text-primary" /></div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-400 mb-1">Current Address</p>
                            {profileData.currentAddress?.street || profileData.currentAddress?.villageCity ? (
                              <p className="text-sm font-semibold text-secondary">
                                {`${profileData.currentAddress.houseNumber || ''}, ${profileData.currentAddress.street || ''}, ${profileData.currentAddress.landmark || ''}, ${profileData.currentAddress.villageCity || ''}, ${profileData.currentAddress.district || ''}, ${profileData.currentAddress.state || ''} - ${profileData.currentAddress.pincode || ''}`}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No current address added yet.</p>
                            )}
                          </div>
                        </div>
 
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="w-5 h-5 text-accent" /></div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-400 mb-1">Permanent Address</p>
                            {profileData.addressSame ? (
                              <p className="text-sm font-semibold text-secondary italic">Same as Current Address</p>
                            ) : (profileData.permanentAddress?.street || profileData.permanentAddress?.villageCity) ? (
                              <p className="text-sm font-semibold text-secondary">
                                {`${profileData.permanentAddress.houseNumber || ''}, ${profileData.permanentAddress.street || ''}, ${profileData.permanentAddress.landmark || ''}, ${profileData.permanentAddress.villageCity || ''}, ${profileData.permanentAddress.district || ''}, ${profileData.permanentAddress.state || ''} - ${profileData.permanentAddress.pincode || ''}`}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No permanent address added yet.</p>
                            )}
                          </div>
                        </div>
 
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="w-5 h-5 text-gray-400" /></div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-400 mb-1">Map Coordinates Location</p>
                            {profileData.address?.street || profileData.address?.city ? (
                              <p className="text-sm font-semibold text-secondary">
                                {profileData.address.formattedAddress || profileData.address.street}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No coordinates set yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bank Details */}
                  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bank Account Details</h3>
                      <button onClick={() => setEditMode({ ...editMode, bank: !editMode.bank })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${editMode.bank ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'}`}>
                        {editMode.bank ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
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
                          className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Save Bank Details
                        </Processing>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><p className="text-xs text-gray-400 mb-1">Holder Name</p><p className="text-sm font-medium text-secondary">{profileData.bankDetails.accountName || '—'}</p></div>
                          <div><p className="text-xs text-gray-400 mb-1">Bank Name</p><p className="text-sm font-medium text-secondary">{profileData.bankDetails.bankName || '—'}</p></div>
                          <div><p className="text-xs text-gray-400 mb-1">Account Number</p><p className="text-sm font-medium text-secondary">{profileData.bankDetails.accountNo || '—'}</p></div>
                          <div><p className="text-xs text-gray-400 mb-1">IFSC Code</p><p className="text-sm font-medium text-secondary">{profileData.bankDetails.ifsc || '—'}</p></div>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-400">Verification Status</span>
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${profileData.bankDetails.verified ? 'bg-primary/10 text-primary' : 'bg-yellow-50 text-yellow-600'}`}>
                            {profileData.bankDetails.verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete Account */}
                  <div className="bg-red-50 border border-red-100 rounded-xl p-5 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-center sm:text-left">
                    <div>
                      <p className="text-sm font-bold text-red-800">Delete Account</p>
                      <p className="text-xs text-red-600">Permanently delete your account and all professional data from the platform.</p>
                    </div>
                    <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: true })} className="w-full sm:w-auto bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-6 font-inter">
                  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-secondary">Notification Settings</h3>
                        <p className="text-xs text-gray-450 mt-0.5">Customize alerts for new bookings and requests</p>
                      </div>
                      <Bell className="w-5 h-5 text-primary" />
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); updateProfile('settings'); }} className="space-y-5">
                      {/* Enable Tone Switch */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-50 opacity-90">
                        <div>
                          <label className="text-sm font-semibold text-secondary">Enable Alert Tone (Always Enabled)</label>
                          <p className="text-xs text-gray-400 mt-0.5">Play a ringtone when a new booking is assigned or offered</p>
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
                      <div className="flex items-center justify-between py-2 border-b border-gray-50">
                        <div>
                          <label className="text-sm font-semibold text-secondary">Enable Vibration</label>
                          <p className="text-xs text-gray-400 mt-0.5">Vibrate device on receiving booking alerts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.notificationPreferences && profileData.notificationPreferences.bookingVibration !== false}
                            onChange={(e) => handlePreferenceChange('bookingVibration', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                       {/* Repeat Alert Tone Switch */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-50 opacity-90">
                        <div>
                          <label className="text-sm font-semibold text-secondary">Repeat Alert Tone (Always Enabled)</label>
                          <p className="text-xs text-gray-400 mt-0.5">Continuously loop the ringtone until booking is accepted, rejected or expired</p>
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
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Alert Ringing Duration</label>
                        <select
                          value={(profileData.notificationPreferences && profileData.notificationPreferences.bookingAlertDuration) || 30}
                          onChange={(e) => handlePreferenceChange('bookingAlertDuration', Number(e.target.value))}
                          className="w-full sm:w-auto px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-white font-semibold text-secondary shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          <option value={5}>5 Seconds</option>
                          <option value={10}>10 Seconds</option>
                          <option value={15}>15 Seconds</option>
                          <option value={30}>30 Seconds</option>
                          <option value={45}>45 Seconds</option>
                          <option value={60}>60 Seconds (Max)</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1.5">Ringtone will automatically stop playing after this duration</p>
                      </div>

                      <Processing
                        type="submit"
                        loading={isSaving}
                        loadingText="Saving Preferences..."
                        className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 shadow-sm transition-all"
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${deleteModal.confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`}>
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