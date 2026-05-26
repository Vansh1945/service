import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, updateprofilepic, toggleFavoriteProvider } from '../../services/CustomerService';
import AddressSelector from '../../components/AddressSelector';
import * as NotificationService from '../../services/NotificationService';
import {
    User, MapPin, Mail, Phone, Camera, LogOut, Shield, Bell,
    ChevronRight, ArrowLeft, CreditCard, Package, Edit2, CheckCircle, Gift, Wallet, ArrowDownLeft, RotateCcw,
    Tag, Copy, Clock, Zap, Star, Heart
} from 'lucide-react';
import { getWalletHistory } from '../../services/CustomerService';
import { getCustomerBookings } from '../../services/BookingService';
import { getAvailableCoupons } from '../../services/CouponService';
import { formatCurrency, formatDate, formatDateTime, compressImage } from '../../utils/format';

const UserProfile = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            lat: null,
            lng: null,
            s2CellId: null,
            s2CellIdPrecise: null,
            houseNumber: '',
            road: '',
            landmark: '',
            area: '',
            pincode: '',
            formattedAddress: '',
            addressLine: ''
        },
        profilePicUrl: '',
        firstBookingUsed: false,
        totalBookings: 0,
        customDiscount: 0,
        wallet: { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() }
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [transactions, setTransactions] = useState({ data: [], summary: {} });
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [couponsLoading, setCouponsLoading] = useState(false);


    const [preferences, setPreferences] = useState({
        booking: true,
        payment: true,
        complaint: true,
        promotional: true,
        providerUpdates: true,
        adminAlerts: true,
        wallet: true,
        reminder: true,
        pushEnabled: true,
        quietHours: { enabled: false, start: '22:00', end: '08:00' }
    });
    const [prefLoading, setPrefLoading] = useState(false);

    const fetchPreferences = async () => {
        try {
            setPrefLoading(true);
            const res = await NotificationService.getPreferences();
            if (res.data?.success) {
                setPreferences(res.data.data);
            }
        } catch (err) {
            toast.error('Failed to load notification settings');
        } finally {
            setPrefLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'settings') {
            fetchPreferences();
        }
    }, [activeTab]);

    const handleTogglePreference = async (key) => {
        try {
            const updatedVal = !preferences[key];
            const res = await NotificationService.updatePreferences({ [key]: updatedVal });
            if (res.data?.success) {
                setPreferences(res.data.data);
                toast.success('Notification preference updated!');
            }
        } catch (err) {
            toast.error('Failed to update preference');
        }
    };

    const handleQuietHoursChange = async (fields) => {
        try {
            const res = await NotificationService.updatePreferences({
                quietHours: { ...preferences.quietHours, ...fields }
            });
            if (res.data?.success) {
                setPreferences(res.data.data);
                toast.success('Quiet hours updated!');
            }
        } catch (err) {
            toast.error('Failed to update quiet hours');
        }
    };

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchTransactions();
            fetchCoupons();
        }
    }, [user]);

    const fetchCoupons = async () => {
        try {
            setCouponsLoading(true);
            const res = await getAvailableCoupons();
            if (res.data?.success) {
                setCoupons(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch coupons', err);
        } finally {
            setCouponsLoading(false);
        }
    };

    const fetchTransactions = async () => {
        try {
            const res = await getWalletHistory();
            if (res.data?.success) {
                setTransactions({
                    data: res.data.data || [],
                    summary: {} // Summary is now handled differently if needed
                });
            }
        } catch (error) {
            console.error('Failed to fetch wallet history', error);
        }
    };

    const fetchProfile = async () => {
        try {
            const response = await getProfile();
            const data = response.data;
            setProfile({
                ...data.user,
                address: data.user.address || { street: '', city: '', state: '', postalCode: '' }
            });
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleBookAgainFavorite = async (fp) => {
        try {
            setLoading(true);
            const res = await getCustomerBookings(new URLSearchParams({ status: 'completed' }));
            const pastBookings = res.data?.data || [];

            const originalBooking = pastBookings.find(
                b => (b.provider?._id || b.provider?.id || b.provider)?.toString() === fp.providerId?.toString()
            );

            if (originalBooking && originalBooking.services?.[0]?.service?._id) {
                navigate(`/customer/book-service/${originalBooking.services[0].service._id}`, {
                    state: { prefillBooking: originalBooking }
                });
            } else {
                toast.info("No past booking details found for this provider. Redirecting to service page...");
                navigate('/customer/services');
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to retrieve booking information.");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFavorite = async (providerId) => {
        try {
            setLoading(true);
            const res = await toggleFavoriteProvider({ providerId });
            if (res.data?.success) {
                toast.success(res.data.message || 'Removed from favorites');
                fetchProfile();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to remove favorite');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => {
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
    };

    // Only saves name and phone — never touches address
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await updateProfile({
                name: profile.name,
                phone: profile.phone
            });
            const data = response.data;
            setIsEditing(false);
            setProfile(prev => ({
                ...prev,
                name: data.user.name || prev.name,
                phone: data.user.phone || prev.phone
            }));
            toast.success('Profile updated successfully!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Saves address only
    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        setAddressLoading(true);
        try {
            const response = await updateProfile({ address: profile.address });
            const data = response.data;
            setIsEditingAddress(false);
            setProfile(prev => ({
                ...prev,
                address: data.user.address || prev.address
            }));
            toast.success('Address updated successfully!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setAddressLoading(false);
        }
    };

    const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

    const handleImageUpload = async () => {
        if (!selectedFile) {
            toast.warning('Please select a file first');
            return;
        }

        try {
            const compressedFile = await compressImage(selectedFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });

            const formData = new FormData();
            formData.append('profilePic', compressedFile);

            const response = await updateprofilepic(formData);
            setProfile(prev => ({ ...prev, profilePicUrl: response.data.profilePicUrl }));
            setSelectedFile(null);
            toast.success('Profile picture updated!');
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-base font-bold text-secondary">My Profile</h1>
                            <p className="text-xs text-gray-400">Manage your account</p>
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
                                { id: 'profile', label: 'My Profile', icon: <User className="w-4 h-4" /> },
                                { id: 'payments', label: 'Wallet & Payments', icon: <Wallet className="w-4 h-4" /> },
                                { id: 'favorites', label: 'Favorite Providers', icon: <Heart className="w-4 h-4" /> },
                                { id: 'offers', label: 'Offers', icon: <Gift className="w-4 h-4" />, secondary: true },
                                { id: 'settings', label: 'Notification Settings', icon: <Bell className="w-4 h-4" /> },
                                { id: 'support', label: 'Support', icon: <Shield className="w-4 h-4" />, secondary: true, action: () => navigate('/customer/complaints') },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.action) item.action();
                                        else { setActiveTab(item.id); setIsEditing(false); }
                                    }}
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
                                    <div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><span className="text-xs">Bookings</span></div>
                                    <span className="text-sm font-bold">{profile.totalBookings}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-accent" /><span className="text-xs">Discount</span></div>
                                    <span className="text-sm font-bold">{profile.customDiscount}%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-xs">First Booking</span></div>
                                    <span className="text-xs font-semibold">{profile.firstBookingUsed ? 'Used' : 'Available'}</span>
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
                                            src={profile.profilePicUrl || `https://ui-avatars.com/api/?name=${profile.name}&background=0D9488&color=fff`}
                                            alt="Profile"
                                            className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover bg-white"
                                        />
                                        {isEditing && (
                                            <>
                                                <label className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 cursor-pointer shadow-md hover:bg-primary/90">
                                                    <Camera className="w-3.5 h-3.5 text-white" />
                                                    <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                                                </label>
                                                {selectedFile && (
                                                    <button onClick={handleImageUpload} className="absolute -top-2 -right-2 bg-accent text-white p-1 rounded-full shadow-md">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1 text-center sm:text-left">
                                        <h2 className="text-xl font-bold text-secondary">{profile.name}</h2>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                                            <span className="hidden sm:block">•</span>
                                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{profile.phone || 'Add phone'}</span>
                                        </div>
                                    </div>

                                    {/* Edit Button */}
                                    <button
                                        onClick={() => setIsEditing(!isEditing)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${isEditing
                                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            : 'bg-primary text-white hover:bg-primary/90'
                                            }`}
                                    >
                                        {isEditing ? 'Cancel' : <span className="flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" /> Edit</span>}
                                    </button>
                                </div>

                                {/* Mobile Quick Links - Only visible on small screens */}
                                <div className="grid grid-cols-5 gap-1 mt-6 lg:hidden border-t border-gray-50 pt-4">
                                    {[
                                        { id: 'payments', label: 'Wallet', icon: <Wallet className="w-4 h-4 text-primary" /> },
                                        { id: 'favorites', label: 'Saved', icon: <Heart className="w-4 h-4 text-rose-500" /> },
                                        { id: 'offers', label: 'Offers', icon: <Gift className="w-4 h-4 text-accent" /> },
                                        { id: 'settings', label: 'Settings', icon: <Bell className="w-4 h-4 text-teal-600" /> },
                                        { id: 'support', label: 'Support', icon: <Shield className="w-4 h-4 text-blue-500" />, action: () => navigate('/customer/complaints') },
                                    ].map((link, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (link.action) link.action();
                                                else { setActiveTab(link.id); setIsEditing(false); }
                                            }}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${activeTab === link.id ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 hover:bg-gray-100'}`}
                                        >
                                            {link.icon}
                                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{link.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Profile Details Form/View */}
                        {activeTab === 'profile' && (
                            <div className="space-y-4">
                                {/* Personal Info Card */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Personal Information</h3>
                                        <button
                                            onClick={() => { setIsEditing(!isEditing); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${isEditing ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'
                                                }`}
                                        >
                                            {isEditing ? 'Cancel' : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
                                        </button>
                                    </div>

                                    {isEditing ? (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={profile.name}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20"
                                                    required
                                                />
                                            </div>
                                            {/* Email - read only */}
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Email Address</label>
                                                <div className="w-full px-3 py-2 text-sm border border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                                    {profile.email}
                                                    <span className="ml-auto text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">Cannot change</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={profile.phone}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                            <button type="submit" disabled={loading} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                                                {loading ? 'Saving...' : 'Save Name & Phone'}
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div><p className="text-xs text-gray-400 mb-1">Full Name</p><p className="text-sm font-medium text-secondary">{profile.name}</p></div>
                                                <div><p className="text-xs text-gray-400 mb-1">Email</p><p className="text-sm font-medium text-secondary">{profile.email}</p></div>
                                                <div><p className="text-xs text-gray-400 mb-1">Phone</p><p className="text-sm font-medium text-secondary">{profile.phone || 'Not provided'}</p></div>
                                            </div>
                                            <div className="pt-2 border-t border-gray-100 flex justify-end">
                                                <button
                                                    onClick={logoutUser}
                                                    className="px-6 py-2 border border-transparent rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors uppercase tracking-widest"
                                                >
                                                    Logout account
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Address Card — separate save */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saved Address</h3>
                                        <button
                                            onClick={() => setIsEditingAddress(!isEditingAddress)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${isEditingAddress ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'
                                                }`}
                                        >
                                            {isEditingAddress ? 'Cancel' : <><Edit2 className="w-3.5 h-3.5" /> Edit Address</>}
                                        </button>
                                    </div>

                                    {isEditingAddress ? (
                                        <form onSubmit={handleAddressSubmit} className="space-y-4">
                                            <AddressSelector
                                                address={profile.address}
                                                onChange={(updatedAddress) => setProfile(prev => ({ ...prev, address: updatedAddress }))}
                                            />
                                            <button type="submit" disabled={addressLoading} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                                                {addressLoading ? 'Saving Address...' : 'Save Address'}
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="w-5 h-5 text-primary" /></div>
                                            <div className="flex-1">
                                                {profile.address.street || profile.address.city ? (
                                                    <p className="text-sm font-semibold text-secondary">
                                                        {profile.address.formattedAddress || profile.address.street}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-gray-400 italic">No address added yet. Click 'Edit Address' to add.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Payments & Wallet View */}
                        {activeTab === 'payments' && (
                            <div className="space-y-5">
                                {/* Wallet Balance Card */}
                                <div className="bg-gradient-to-br from-secondary to-gray-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-white/5">
                                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-primary/20 rounded-full blur-3xl"></div>
                                    <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-accent/10 rounded-full blur-2xl"></div>
                                    <div className="relative z-10">
                                        {/* Balance Header */}
                                        <div className="flex items-center justify-between mb-5">
                                            <p className="text-white/60 text-[10px] uppercase tracking-widest font-black flex items-center gap-2">
                                                <Wallet className="w-4 h-4 text-primary" /> My Wallet
                                            </p>
                                            <button
                                                onClick={() => { fetchProfile(); fetchTransactions(); }}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all active:scale-90"
                                                title="Sync Balance"
                                            >
                                                <RotateCcw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Main balance */}
                                        <div className="mb-6">
                                            <p className="text-white/40 text-xs mb-1">Available Balance</p>
                                            <h3 className="text-5xl font-black tracking-tighter text-white">
                                                {formatCurrency(profile.wallet?.availableBalance || 0)}
                                            </h3>
                                        </div>

                                        {/* 4-stat grid */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                                <p className="text-[9px] text-primary uppercase tracking-wider font-black mb-1">Refund Credits</p>
                                                <p className="text-base font-black text-white">{formatCurrency(profile.wallet?.totalRefunded || 0)}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                                <p className="text-[9px] text-white/40 uppercase tracking-wider font-black mb-1">Total Debit</p>
                                                <p className="text-base font-black text-white">
                                                    {formatCurrency(transactions.data.filter(t => t.type === 'debit').reduce((acc, t) => acc + t.amount, 0))}
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                                <p className="text-[9px] text-accent uppercase tracking-wider font-black mb-1">Cashback</p>
                                                <p className="text-base font-black text-white/40">—</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Wallet Activity */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-secondary">Wallet Activity</h3>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Refunds & wallet payments only</p>
                                        </div>
                                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                            {transactions?.data?.length || 0} entries
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        {(transactions?.data?.length || 0) > 0 ? (
                                            <div className="space-y-3">
                                                {transactions.data.map(entry => {
                                                    const isCredit = entry.type === 'credit';
                                                    const amountColor = isCredit ? 'text-emerald-600' : 'text-red-500';
                                                    const IconComponent = isCredit ? ArrowDownLeft : Wallet;
                                                    const iconBg = isCredit
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : 'bg-red-50 text-red-500 border border-red-100';

                                                    return (
                                                        <div key={entry._id} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                                                    <IconComponent className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-secondary leading-none mb-1">{entry.reason}</p>
                                                                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                                                                        {entry.booking?.bookingId ? `Booking: #${entry.booking.bookingId}` : 'Transaction ID: ' + (entry._id.slice(-8).toUpperCase())}
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(entry.createdAt)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0 ml-3">
                                                                <p className={`text-base font-black ${amountColor}`}>
                                                                    {isCredit ? '+' : '−'}{formatCurrency(entry.amount)}
                                                                </p>
                                                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${isCredit
                                                                    ? 'bg-emerald-50 text-emerald-600'
                                                                    : 'bg-red-50 text-red-500'
                                                                    }`}>
                                                                    {isCredit ? 'Credit' : 'Debit'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                                    <Wallet className="w-7 h-7 text-gray-300" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-500">No wallet activity yet</p>
                                                <p className="text-xs text-gray-400 mt-1.5 max-w-[200px] mx-auto">
                                                    Refunds and wallet payments will appear here.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'offers' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-secondary">Available Offers</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">Coupons you can use on your next booking</p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                        {coupons.length} available
                                    </span>
                                </div>

                                {couponsLoading ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : coupons.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                            <Gift className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-500">No offers available</p>
                                        <p className="text-xs text-gray-400 mt-1.5 max-w-[200px] mx-auto">
                                            Check back later for exclusive deals and discounts.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {coupons.map(coupon => {
                                            const isPercent = coupon.discountType === 'percent';
                                            const isExpiringSoon = coupon.expiryDate && (new Date(coupon.expiryDate) - new Date()) < 3 * 24 * 60 * 60 * 1000;
                                            const isFirstBooking = coupon.isFirstBooking;
                                            const isPersonal = coupon.assignedTo;

                                            return (
                                                <div
                                                    key={coupon._id}
                                                    className="relative bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
                                                >
                                                    {/* Top color strip */}
                                                    <div className={`h-1 w-full ${isFirstBooking ? 'bg-gradient-to-r from-violet-500 to-purple-500'
                                                            : isPersonal ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                                                : 'bg-gradient-to-r from-primary to-teal-400'
                                                        }`} />

                                                    <div className="p-3">
                                                        {/* Badges row */}
                                                        <div className="flex items-center gap-1 mb-2 flex-wrap">
                                                            {isFirstBooking && (
                                                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-full">
                                                                    <Star className="w-2.5 h-2.5" /> First Booking
                                                                </span>
                                                            )}
                                                            {isPersonal && (
                                                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                                                                    <Zap className="w-2.5 h-2.5" /> Personal
                                                                </span>
                                                            )}
                                                            {!isFirstBooking && !isPersonal && (
                                                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                                                    <Tag className="w-2.5 h-2.5" /> Global
                                                                </span>
                                                            )}
                                                            {isExpiringSoon && (
                                                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                                                                    <Clock className="w-2.5 h-2.5" /> Expiring Soon
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Discount amount */}
                                                        <div className="flex items-end justify-between mb-2">
                                                            <div>
                                                                <p className={`text-xl font-black tracking-tighter ${isFirstBooking ? 'text-violet-600'
                                                                        : isPersonal ? 'text-amber-500'
                                                                            : 'text-primary'
                                                                    }`}>
                                                                    {isPercent ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                                                                    <span className="text-xs font-bold ml-1">OFF</span>
                                                                </p>
                                                                {coupon.minBookingValue > 0 && (
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                                        Min order: <span className="font-semibold text-gray-600">{formatCurrency(coupon.minBookingValue)}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Coupon code + copy */}
                                                        <div className="flex items-center justify-between bg-gray-50 border border-dashed border-gray-200 rounded-lg px-2.5 py-1.5">
                                                            <span className="text-xs font-black tracking-widest text-secondary font-mono">{coupon.code}</span>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(coupon.code);
                                                                    toast.success(`Copied: ${coupon.code}`);
                                                                }}
                                                                className="p-1 rounded-md bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all active:scale-90"
                                                                title="Copy code"
                                                            >
                                                                <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary" />
                                                            </button>
                                                        </div>

                                                        {/* Expiry */}
                                                        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Valid till: <span className="font-semibold text-gray-500">{formatDate(coupon.expiryDate)}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-secondary">Notification Settings</h3>
                                    <p className="text-xs text-gray-500">Configure how and when you receive updates from our system.</p>
                                </div>

                                <div className="space-y-4">
                                    {/* Master Push Toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-55/50 border border-gray-100 hover:border-gray-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                <Bell className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-secondary">Enable Push Notifications</p>
                                                <p className="text-xs text-gray-500">Receive real-time alerts on your device</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleTogglePreference('pushEnabled')}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${preferences.pushEnabled ? 'bg-primary' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Quiet Hours Block */}
                                    <div className="p-4 rounded-xl bg-gray-55/50 border border-gray-100 hover:border-gray-200 transition-all space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                                                    <Shield className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-secondary">Quiet Hours</p>
                                                    <p className="text-xs text-gray-500">Silence push notifications during set hours</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleQuietHoursChange({ enabled: !preferences.quietHours?.enabled })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${preferences.quietHours?.enabled ? 'bg-indigo-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.quietHours?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {preferences.quietHours?.enabled && (
                                            <div className="flex items-center gap-4 pl-12 pt-2 transition-all">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Start Time</label>
                                                    <input
                                                        type="time"
                                                        value={preferences.quietHours?.start || '22:00'}
                                                        onChange={(e) => handleQuietHoursChange({ start: e.target.value })}
                                                        className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium text-gray-700 shadow-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">End Time</label>
                                                    <input
                                                        type="time"
                                                        value={preferences.quietHours?.end || '08:00'}
                                                        onChange={(e) => handleQuietHoursChange({ end: e.target.value })}
                                                        className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white font-medium text-gray-700 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Granular Preferences Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        {[
                                            { key: 'booking', label: 'Bookings', desc: 'Updates about requested and active bookings', icon: <Package className="w-4 h-4 text-blue-500" /> },
                                            { key: 'payment', label: 'Payments', desc: 'Invoices, transaction updates, and receipts', icon: <CreditCard className="w-4 h-4 text-emerald-500" /> },
                                            { key: 'complaint', label: 'Complaints', desc: 'Updates on resolved support requests', icon: <Shield className="w-4 h-4 text-rose-500" /> },
                                            { key: 'wallet', label: 'Wallet Activity', desc: 'Refunds and credits to your wallet', icon: <Wallet className="w-4 h-4 text-indigo-500" /> },
                                            { key: 'promotional', label: 'Offers & Promos', desc: 'Discounts, seasonal updates, and announcements', icon: <Gift className="w-4 h-4 text-amber-500" /> },
                                            { key: 'reminder', label: 'Reminders', desc: 'Alerts for upcoming bookings and arrivals', icon: <User className="w-4 h-4 text-teal-500" /> }
                                        ].map(item => (
                                            <div key={item.key} className="flex items-start justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all bg-white shadow-sm">
                                                <div className="flex gap-3 min-w-0">
                                                    <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                                                        {item.icon}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-secondary truncate">{item.label}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleTogglePreference(item.key)}
                                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${preferences[item.key] ? 'bg-primary' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences[item.key] ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'favorites' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-secondary">My Favorite Providers</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">Quickly rebook or manage your preferred service professionals</p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                        {profile.favoriteProviders?.length || 0} saved
                                    </span>
                                </div>

                                {(!profile.favoriteProviders || profile.favoriteProviders.length === 0) ? (
                                    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-sm">
                                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
                                            <Heart className="w-8 h-8 text-rose-500 fill-rose-100" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-500">No favorite providers yet</p>
                                        <p className="text-xs text-gray-400 mt-1.5 max-w-sm mx-auto">
                                            You can save your preferred service providers by clicking "❤️ Add to Favorites" on completed booking cards!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {profile.favoriteProviders.map((fp) => (
                                            <div key={fp.providerId} className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                                                {/* Top Status Bar indicator */}
                                                <div className={`absolute top-0 left-0 right-0 h-1 ${fp.isOnline ? 'bg-emerald-400' : 'bg-gray-200'}`} />

                                                <div className="flex gap-3.5 items-start mt-1">
                                                    {/* Avatar & Online status */}
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={fp.profilePicUrl || `https://ui-avatars.com/api/?name=${fp.providerName}&background=0D9488&color=fff`}
                                                            alt={fp.providerName}
                                                            className="w-12 h-12 rounded-xl object-cover border border-gray-100"
                                                        />
                                                        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${fp.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                                                            }`} />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-sm font-bold text-secondary truncate">{fp.providerName}</h4>
                                                        <span className="inline-block text-[10px] font-black uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded-md mt-0.5">
                                                            {fp.category}
                                                        </span>

                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                                            {fp.rating > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                                                    <span className="text-xs font-bold text-secondary">{fp.rating.toFixed(1)}/5</span>
                                                                </div>
                                                            )}
                                                            {fp.rating > 0 && <span className="text-gray-300 text-xs">•</span>}
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" />
                                                                <span className="font-semibold text-secondary">{fp.completedBookings || 0} completed bookings</span>
                                                            </div>
                                                        </div>

                                                        {fp.lastBookedAt && (
                                                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1.5 font-medium">
                                                                <Clock className="w-3 h-3 text-gray-300" />
                                                                Last booked: {new Date(fp.lastBookedAt).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 border-t border-gray-50 pt-3 mt-4">
                                                    <button
                                                        onClick={() => handleBookAgainFavorite(fp)}
                                                        className="flex-1 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-lg transition-all active:scale-95 shadow-sm"
                                                    >
                                                        Book Again
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveFavorite(fp.providerId)}
                                                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
