import { useState, useEffect } from 'react';
import ProfileSkeleton from '../../../components/ui-skeletons/ProfileSkeleton';
import { useAuth } from '../../../context/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../../../services/CustomerService';
import AddressSelector from '../../../components/AddressSelector';
import Processing from '../../../components/ui-skeletons/Processing';
import {
    User, MapPin, Shield, ChevronRight, Gift, Wallet, Heart, LogOut
} from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

import PersonalDetails from './Components/PersonalDetails';
import WalletActivity from './Components/WalletActivity';
import FavoriteProviders from './Components/FavoriteProviders';
import CouponsOffers from './Components/CouponsOffers';

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
    const [addressLoading, setAddressLoading] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [couponsLoading, setCouponsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

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

    const onBack = () => {
        setActiveTab('profile');
        setIsEditing(false);
    };

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

                        {/* Profile Details Tab */}
                        {activeTab === 'profile' && (
                            <>
                                <PersonalDetails
                                    profile={profile}
                                    setProfile={setProfile}
                                    isEditing={isEditing}
                                    setIsEditing={setIsEditing}
                                    isWalletEnabled={isWalletEnabled}
                                >
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
                                </PersonalDetails>

                                {!isEditing && (
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

                        {/* Payments & Wallet Tab */}
                        {activeTab === 'payments' && (
                            <WalletActivity
                                profile={profile}
                                onBack={onBack}
                            />
                        )}

                        {/* Offers Tab */}
                        <div className={activeTab === 'offers' ? 'block' : 'hidden'}>
                            <CouponsOffers
                                coupons={coupons}
                                setCoupons={setCoupons}
                                couponsLoading={couponsLoading}
                                setCouponsLoading={setCouponsLoading}
                                profile={profile}
                                onBack={onBack}
                            />
                        </div>

                        {/* Favorites Tab */}
                        {activeTab === 'favorites' && (
                            <FavoriteProviders
                                profile={profile}
                                fetchProfile={fetchProfile}
                                onBack={onBack}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
