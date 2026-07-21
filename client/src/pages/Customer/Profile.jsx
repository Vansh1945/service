import { useState, useEffect } from 'react';
import ProfileSkeleton from '../../components/ui-skeletons/ProfileSkeleton';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, updateprofilepic, toggleFavoriteProvider } from '../../services/CustomerService';
import AddressSelector from '../../components/AddressSelector';
import Processing from '../../components/ui-skeletons/Processing';
import {
    User, MapPin, Mail, Phone, Camera, Shield,
    ChevronRight, ArrowLeft, Package, Edit2, CheckCircle, Gift, Wallet, ArrowDownLeft, ArrowUpRight,
    Tag, Copy, Clock, Zap, Star, Heart, MessageSquare, LogOut
} from 'lucide-react';
import { getWalletHistory } from '../../services/CustomerService';
import { getCustomerBookings } from '../../services/BookingService';
import { getAvailableCoupons } from '../../services/CouponService';
import { formatCurrency, formatDate, formatDateTime, compressImage } from '../../utils/format';

const UserProfile = () => {
    const { user, logoutUser, systemSettings } = useAuth();
    const isWalletEnabled = systemSettings?.featureFlags?.walletEnabled !== false;
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
    const [pageLoading, setPageLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [transactions, setTransactions] = useState({ data: [], summary: {} });
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [couponsLoading, setCouponsLoading] = useState(false);

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
                    summary: {}
                });
            }
        } catch (error) {
            console.error('Failed to fetch wallet history', error);
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

    const fetchProfile = async () => {
        try {
            setPageLoading(true);
            const res = await getProfile();
            if (res?.data?.user) {
                setProfile(prev => ({ ...prev, ...res.data.user }));
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load profile');
        } finally {
            setPageLoading(false);
        }
    };

    const getUserInitials = () => {
        if (!profile.name) return 'C';
        return profile.name.split(' ').map(name => name[0]).join('').toUpperCase();
    };

    if (pageLoading) {
        return <ProfileSkeleton />;
    }

    const navigationItems = [
        { id: 'profile', label: 'Personal Details', icon: <User className="w-4 h-4" /> },
        isWalletEnabled && { id: 'payments', label: 'Wallet & Activity', icon: <Wallet className="w-4 h-4" /> },
        { id: 'favorites', label: 'Favorite Providers', icon: <Heart className="w-4 h-4" /> },
        { id: 'offers', label: 'Coupons & Offers', icon: <Gift className="w-4 h-4" /> }
    ].filter(Boolean);

    const quickActions = [
        isWalletEnabled && { id: 'payments', label: 'Wallet', icon: <Wallet className="w-5 h-5" />, color: 'bg-primary/10 text-primary' },
        { id: 'favorites', label: 'Favorites', icon: <Heart className="w-5 h-5" />, color: 'bg-rose-50 text-rose-500' },
        { id: 'offers', label: 'Offers', icon: <Gift className="w-5 h-5" />, color: 'bg-amber-50 text-amber-500' },
        { id: 'support', label: 'Support', icon: <Shield className="w-5 h-5" />, color: 'bg-blue-50 text-blue-500', action: () => navigate('/customer/complaints') }
    ].filter(Boolean);

    const renderBackHeader = (title) => (
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-neutral-100 xl:hidden">
            <button onClick={() => { setActiveTab('profile'); setIsEditing(false); }} className="p-1 rounded-full hover:bg-neutral-100 transition-colors">
                <ArrowLeft className="w-4.5 h-4.5 text-neutral-600" />
            </button>
            <h2 className="text-sm font-black text-secondary uppercase tracking-wider">{title}</h2>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-50/50 pb-12 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    
                    {/* Desktop Sidebar Layout */}
                    <div className="hidden xl:block space-y-4">
                        <div className="bg-white rounded-2xl border border-neutral-100 p-2 shadow-sm">
                            {navigationItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => { setActiveTab(item.id); setIsEditing(false); }}
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
                                    <span className="text-neutral-400">Bookings</span>
                                    <span>{profile.totalBookings}</span>
                                </div>
                                {isWalletEnabled && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-neutral-400">Wallet</span>
                                        <span className="text-success">{formatCurrency(profile.wallet?.availableBalance || 0)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-neutral-400">Saved Providers</span>
                                    <span>{profile.favoriteProviders?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-neutral-400">Coupons</span>
                                    <span>{coupons.length}</span>
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
                                                    src={profile.profilePicUrl || `https://ui-avatars.com/api/?name=${profile.name}&background=0D9488&color=fff`}
                                                    alt="Profile"
                                                    className="w-14 h-14 rounded-xl border-2 border-white object-cover shadow-sm bg-neutral-50"
                                                />
                                                <label className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1 cursor-pointer shadow hover:bg-primary/95 transition-colors">
                                                    <Camera className="w-3 h-3" />
                                                    <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                                                </label>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-sm font-black text-secondary truncate">{profile.name}</h2>
                                                    {isWalletEnabled && profile.wallet && (
                                                        <span className="inline-flex items-center text-[9px] font-black bg-success/15 text-emerald-700 px-1.5 py-0.5 rounded select-none">
                                                            ₹{profile.wallet.availableBalance || 0}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-neutral-400 font-bold mt-0.5 truncate">{profile.email}</p>
                                                <p className="text-[10px] text-neutral-400 font-bold mt-0.5">{profile.phone || 'Add phone number'}</p>
                                                {selectedFile && (
                                                    <button onClick={handleImageUpload} className="mt-1 text-[9px] bg-primary text-white px-2 py-0.5 rounded font-black hover:opacity-90 transition-opacity">
                                                        Upload Pic
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(!isEditing)}
                                            className={`p-2 rounded-xl border transition-all shrink-0 ${isEditing ? 'bg-neutral-100 border-neutral-200 text-secondary' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}
                                            title="Edit Profile"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Compact Quick Actions Grid */}
                                <div className="grid grid-cols-4 gap-3">
                                    {quickActions.map((action) => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                if (action.action) action.action();
                                                else { setActiveTab(action.id); setIsEditing(false); }
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

                                {/* Editable Sections (Personal Info and Saved Address) */}
                                {isEditing ? (
                                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                                        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Edit Personal Information</h3>
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 mb-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={profile.name}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 mb-1">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={profile.phone}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                                />
                                            </div>
                                            <Processing type="submit" loading={loading} loadingText="Saving Details..." className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-95 transition-opacity">
                                                Save Profile Details
                                            </Processing>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Address Card */}
                                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Saved Address</h3>
                                                    <button onClick={() => setIsEditingAddress(!isEditingAddress)} className="text-[10px] font-bold text-primary hover:underline">
                                                        {isEditingAddress ? 'Cancel' : 'Edit Address'}
                                                    </button>
                                                </div>
                                                {isEditingAddress ? (
                                                    <form onSubmit={handleAddressSubmit} className="space-y-3">
                                                        <AddressSelector
                                                            address={profile.address}
                                                            onChange={(updatedAddress) => setProfile(prev => ({ ...prev, address: updatedAddress }))}
                                                        />
                                                        <Processing type="submit" loading={addressLoading} loadingText="Saving Address..." className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold">
                                                            Save Address
                                                        </Processing>
                                                    </form>
                                                ) : (
                                                    <div className="flex items-start gap-2.5">
                                                        <MapPin className="w-4.5 h-4.5 text-neutral-400 mt-0.5" />
                                                        <p className="text-xs font-bold text-secondary leading-normal">
                                                            {profile.address.formattedAddress || profile.address.street || 'No address added yet.'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mobile Logout option */}
                                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 flex flex-col justify-center items-center xl:hidden min-h-[100px]">
                                            <button onClick={logoutUser} className="flex items-center gap-2 px-4 py-2 border border-danger/20 hover:bg-danger/5 rounded-xl text-xs font-black text-danger uppercase tracking-wider transition-colors">
                                                <LogOut className="w-4 h-4" /> Sign Out of Account
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Payments & Wallet View */}
                        {activeTab === 'payments' && (
                            <div className="space-y-4">
                                {renderBackHeader('Wallet & Activity')}
                                
                                {/* Wallet Card */}
                                <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                                    <div>
                                        <p className="text-neutral-400 text-[10px] font-black uppercase tracking-wider">Available Balance</p>
                                        <h3 className="text-3xl font-black text-secondary tracking-tight mt-1">
                                            {formatCurrency(profile.wallet?.availableBalance || 0)}
                                        </h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="bg-neutral-50 rounded-xl px-3 py-2 border border-neutral-100 text-left min-w-[90px]">
                                            <p className="text-[8px] text-neutral-400 font-bold uppercase">Refunds</p>
                                            <p className="text-xs font-bold text-secondary mt-0.5">{formatCurrency(profile.wallet?.totalRefunded || 0)}</p>
                                        </div>
                                        <div className="bg-neutral-50 rounded-xl px-3 py-2 border border-neutral-100 text-left min-w-[90px]">
                                            <p className="text-[8px] text-neutral-400 font-bold uppercase">Debited</p>
                                            <p className="text-xs font-bold text-secondary mt-0.5">
                                                {formatCurrency(transactions.data.filter(t => t.type === 'debit').reduce((acc, t) => acc + t.amount, 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction History (Google Pay Style) */}
                                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-neutral-50/50 flex items-center justify-between border-b border-neutral-100">
                                        <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Transaction History</h3>
                                        <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                            {transactions?.data?.length || 0} entries
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        {(transactions?.data?.length || 0) > 0 ? (
                                            <div className="divide-y divide-neutral-100">
                                                {transactions.data.map(entry => {
                                                    const isCredit = entry.type === 'credit';
                                                    const amountColor = isCredit ? 'text-emerald-600' : 'text-neutral-700';
                                                    const IconComponent = isCredit ? ArrowDownLeft : ArrowUpRight;
                                                    const iconBg = isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-600';

                                                    return (
                                                        <div key={entry._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                                                    <IconComponent className="w-4 h-4" />
                                                                </div>
                                                                <div className="text-left">
                                                                     <p className="text-xs font-bold text-secondary leading-tight">{entry.reason}</p>
                                                                     <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                         <p className="text-[9px] text-neutral-400">{formatDateTime(entry.createdAt)}</p>
                                                                         {entry.booking?.bookingId && (
                                                                             <>
                                                                                 <span className="w-1 h-1 rounded-full bg-neutral-300" />
                                                                                 <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">
                                                                                     ID: {entry.booking.bookingId}
                                                                                 </span>
                                                                             </>
                                                                         )}
                                                                     </div>
                                                                 </div>
                                                            </div>
                                                            <div className="text-right shrink-0 ml-3">
                                                                <p className={`text-xs font-black ${amountColor}`}>
                                                                    {isCredit ? '+' : '−'}{formatCurrency(entry.amount)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-10">
                                                <Wallet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-neutral-400">No activity yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Offers View */}
                        {activeTab === 'offers' && (
                            <div className="space-y-4">
                                {renderBackHeader('Offers & Coupons')}
                                
                                {couponsLoading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[1, 2].map(i => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
                                    </div>
                                ) : coupons.length === 0 ? (
                                    <div className="text-center py-10 bg-white rounded-2xl border border-neutral-100 p-8 shadow-sm">
                                        <Gift className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-neutral-400">No coupons available</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {coupons.map(coupon => {
                                            const userId = user?.id || user?._id;
                                            const hasRedeemed = coupon?.usedBy?.some(u => {
                                                const uId = u?.user?._id || u?.user || u;
                                                return uId && userId && uId.toString() === userId.toString();
                                            });
                                            const isUsed = hasRedeemed || (coupon.isFirstBooking && profile.firstBookingUsed);

                                            return (
                                                <div key={coupon._id} className="bg-white border border-neutral-100 rounded-xl p-4 shadow-sm flex flex-col justify-between text-left hover:border-primary/20 transition-all">
                                                    <div>
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                                {coupon.discountValue}% OFF
                                                            </span>
                                                            {isUsed && (
                                                                <span className="text-[9px] font-black uppercase bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">
                                                                    Used
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-xs font-bold text-secondary">{coupon.code}</h4>
                                                        <p className="text-[10px] text-neutral-400 mt-1">Min Order: {formatCurrency(coupon.minBookingValue)}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-50">
                                                        <span className="text-[9px] text-neutral-400">Exp: {formatDate(coupon.expiryDate)}</span>
                                                        <button
                                                            onClick={() => {
                                                                if (isUsed) return;
                                                                navigator.clipboard.writeText(coupon.code);
                                                                toast.success(`Copied: ${coupon.code}`);
                                                            }}
                                                            disabled={isUsed}
                                                            className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${
                                                                isUsed 
                                                                    ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed' 
                                                                    : 'bg-neutral-50 hover:bg-neutral-100 text-primary border-neutral-150'
                                                            }`}
                                                        >
                                                            {isUsed ? 'Used' : 'Apply Code'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Favorites View */}
                        {activeTab === 'favorites' && (
                            <div className="space-y-4">
                                {renderBackHeader('Favorite Providers')}

                                {(!profile.favoriteProviders || profile.favoriteProviders.length === 0) ? (
                                    <div className="bg-white rounded-2xl border border-neutral-100 p-10 text-center shadow-sm">
                                        <Heart className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-neutral-400">No favorites saved yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {profile.favoriteProviders.map((fp) => (
                                            <div key={fp.providerId} className="bg-white rounded-2xl border border-neutral-100 p-4 flex flex-col justify-between shadow-sm text-left hover:border-neutral-200 transition-all">
                                                <div className="flex gap-3 items-start">
                                                    <img
                                                        src={fp.profilePicUrl || `https://ui-avatars.com/api/?name=${fp.providerName}&background=0D9488&color=fff`}
                                                        alt={fp.providerName}
                                                        className="w-10 h-10 rounded-xl object-cover border border-neutral-100"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-xs font-bold text-secondary truncate">{fp.providerName}</h4>
                                                        <span className="inline-block text-[9px] font-black uppercase text-primary bg-primary/5 px-2 py-0.5 rounded mt-1">
                                                            {fp.category}
                                                        </span>
                                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500 font-bold">
                                                            <span className="flex items-center gap-0.5"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {fp.rating > 0 ? fp.rating.toFixed(1) : 'New'}</span>
                                                            <span>{fp.completedBookings || 0} bookings</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 border-t border-neutral-50 pt-3 mt-3">
                                                    <button
                                                        onClick={() => handleBookAgainFavorite(fp)}
                                                        className="flex-1 py-1.5 text-[10px] font-bold text-white bg-primary rounded-lg transition-all active:scale-95 shadow-sm"
                                                    >
                                                        Book Again
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveFavorite(fp.providerId)}
                                                        className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
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
