import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, updateprofilepic } from '../../services/CustomerService';
import AddressSelector from '../../components/AddressSelector';
import * as NotificationService from '../../services/NotificationService';
import {
    User, MapPin, Mail, Phone, Camera, LogOut, Shield, Bell,
    ChevronRight, ArrowLeft, CreditCard, Package, Edit2, CheckCircle, Gift, Wallet, ArrowDownLeft, RotateCcw, Navigation
} from 'lucide-react';
import { getWalletHistory } from '../../services/CustomerService';
import { formatCurrency, formatDate, formatDateTime, compressImage, cleanAddressFields } from '../../utils/format';
import LocationPickerModal from '../../components/LocationPickerModal';

const UserProfile = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const autocompleteInputRef = useRef(null);
    const [detecting, setDetecting] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: { street: '', city: '', state: '', postalCode: '' },
        profilePicUrl: '',
        firstBookingUsed: false,
        totalBookings: 0,
        customDiscount: 0,
        wallet: { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() }
    });
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [transactions, setTransactions] = useState({ data: [], summary: {} });
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);

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



    useEffect(() => {
        // Autocomplete disabled for Nominatim. Can type directly.
    }, [isEditing]);

    const handleDetectAddress = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setDetecting(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                    const data = await response.json();
                    
                    if (data && data.address) {
                        const cleanFields = cleanAddressFields(data.address, data.display_name);
                        
                        setProfile(prev => ({
                            ...prev,
                            address: {
                                street: cleanFields.street,
                                city: cleanFields.city,
                                state: cleanFields.state,
                                postalCode: cleanFields.postalCode
                            }
                        }));
                        toast.success('Address auto-detected successfully!');
                    } else {
                        toast.error('Failed to resolve current address details');
                    }
                } catch (error) {
                    toast.error('Error connecting to map service');
                } finally {
                    setDetecting(false);
                }
            },
            (error) => {
                setDetecting(false);
                console.error(error);
                toast.error('Failed to retrieve location coordinates');
            },
            { enableHighAccuracy: true }
        );
    };

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
        }
    }, [user]);

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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({
            ...prev,
            address: { ...prev.address, [name]: value }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await updateProfile(profile);
            const data = response.data;
            setIsEditing(false);
            setProfile(prev => ({
                ...prev,
                ...data.user,
                address: data.user.address || prev.address
            }));
            toast.success('Profile updated successfully!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
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
                                <div className="grid grid-cols-4 gap-2 mt-6 lg:hidden border-t border-gray-50 pt-4">
                                    {[
                                        { id: 'payments', label: 'Wallet', icon: <Wallet className="w-4 h-4 text-primary" /> },
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
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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
                                    <div className="pt-2 border-t border-gray-100">
                                        <h3 className="text-sm font-semibold text-secondary mb-3">Address</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-xs font-semibold text-gray-500">Street Address</label>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMapModalOpen(true)}
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-teal-700 transition-colors uppercase tracking-wider"
                                                    >
                                                        <MapPin className="w-3 h-3" />
                                                        Pick on Map
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={detecting}
                                                        onClick={handleDetectAddress}
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-teal-700 disabled:opacity-50 transition-colors uppercase tracking-wider"
                                                    >
                                                        <Navigation className={`w-3 h-3 ${detecting ? 'animate-ping' : ''}`} />
                                                        {detecting ? 'Detecting...' : 'Auto Detect'}
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                ref={autocompleteInputRef}
                                                type="text"
                                                name="street"
                                                value={profile.address.street}
                                                onChange={handleAddressChange}
                                                placeholder="Street Address"
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                            />
                                            <AddressSelector
                                                selectedState={profile.address.state}
                                                selectedCity={profile.address.city}
                                                onStateChange={(state) => setProfile(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, state, city: '' }
                                                }))}
                                                onCityChange={(city) => setProfile(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, city }
                                                }))}
                                            />
                                            <input
                                                type="text"
                                                name="postalCode"
                                                value={profile.address.postalCode}
                                                onChange={handleAddressChange}
                                                placeholder="Postal Code"
                                                maxLength="6"
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    {/* Personal Info Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><p className="text-xs text-gray-400 mb-1">Full Name</p><p className="text-sm font-medium text-secondary">{profile.name}</p></div>
                                        <div><p className="text-xs text-gray-400 mb-1">Email</p><p className="text-sm font-medium text-secondary">{profile.email}</p></div>
                                        <div><p className="text-xs text-gray-400 mb-1">Phone</p><p className="text-sm font-medium text-secondary">{profile.phone || 'Not provided'}</p></div>
                                    </div>

                                    {/* Address */}
                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="w-5 h-5 text-primary" /></div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-secondary mb-1">Saved Address</h3>
                                                {profile.address.street || profile.address.city ? (
                                                    <div className="text-sm text-gray-500">
                                                        <p className="font-semibold text-secondary">{profile.address.street}</p>
                                                        <p>{profile.address.city}, {profile.address.state}</p>
                                                        <p>{profile.address.postalCode}</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-400 italic">No address added yet</p>
                                                )}
                                            </div>
                                        </div>
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
                                                <Wallet className="w-4 h-4 text-primary"/> My Wallet
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
                                                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                                    isCredit
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
                                                    <Wallet className="w-7 h-7 text-gray-300"/>
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

                    </div>
                </div>
            </div>

            {isMapModalOpen && (
                <LocationPickerModal
                    isOpen={isMapModalOpen}
                    onClose={() => setIsMapModalOpen(false)}
                    onLocationSelect={(loc) => {
                        setProfile(prev => ({
                            ...prev,
                            address: {
                                ...prev.address,
                                street: loc.street,
                                city: loc.city || prev.address.city,
                                state: loc.state || prev.address.state,
                                postalCode: loc.postalCode || prev.address.postalCode
                            }
                        }));
                        toast.success('Address picked from map!');
                    }}
                />
            )}
        </div>
    );
};

export default UserProfile;