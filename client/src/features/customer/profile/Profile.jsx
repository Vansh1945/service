import { useState, useEffect } from 'react';
import ProfileSkeleton from '../../../components/ui-skeletons/ProfileSkeleton';
import { toast } from '../../../components/ui/Toast';

import { useNavigate } from 'react-router-dom';
import {
    getProfile,
    updateProfile,
    getSavedAddresses,
    createSavedAddress,
    updateSavedAddress,
    deleteSavedAddress,
    setDefaultSavedAddress
} from '../../../services/CustomerService';
import AddressSelector from '../../../components/AddressSelector';
import AddressModal from '../../../components/modals/AddressModal';
import Processing from '../../../components/ui-skeletons/Processing';
import DeleteConfirmModal from '../../../components/modals/DeleteConfirmModal';
import {
    User, MapPin, Shield, ChevronRight, Gift, Wallet, Heart, LogOut,
    Plus, Home, Briefcase, ShoppingBag, Star, Trash2, Edit3, CheckCircle2, X, ArrowLeft
} from 'lucide-react';
import { formatCurrency } from '../../../utils/format';

import PersonalDetails from './Components/PersonalDetails';
import WalletActivity from './Components/WalletActivity';
import FavoriteProviders from './Components/FavoriteProviders';
import CouponsOffers from './Components/CouponsOffers';

const LABEL_OPTIONS = [
    { id: 'Home', label: 'Home', icon: Home },
    { id: 'Office', label: 'Office', icon: Briefcase },
    { id: 'Shop', label: 'Shop', icon: ShoppingBag },
    { id: 'Other', label: 'Other', icon: MapPin }
];

const SavedAddressesSection = ({ profile, fetchProfile, onBack }) => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [deletingAddressId, setDeletingAddressId] = useState(null);

    const [addressForm, setAddressForm] = useState({
        label: 'Home',
        houseNumber: '',
        road: '',
        landmark: '',
        area: '',
        city: '',
        state: '',
        pincode: '',
        postalCode: '',
        formattedAddress: '',
        lat: null,
        lng: null,
        isDefault: false
    });
    const [formErrors, setFormErrors] = useState({});

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        try {
            setLoading(true);
            const res = await getSavedAddresses();
            if (res.data?.success) {
                setAddresses(res.data.savedAddresses || []);
            }
        } catch (err) {
            console.error('Error fetching addresses:', err);
            toast.error('Failed to load saved addresses');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingAddress(null);
        setAddressForm({
            label: 'Home',
            houseNumber: '',
            road: '',
            landmark: '',
            area: '',
            city: '',
            state: '',
            pincode: '',
            postalCode: '',
            formattedAddress: '',
            lat: null,
            lng: null,
            isDefault: false
        });
        setFormErrors({});
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (addr) => {
        setEditingAddress(addr);
        setAddressForm({
            _id: addr._id,
            label: addr.label || 'Home',
            houseNumber: addr.houseNumber || '',
            road: addr.road || addr.street || '',
            landmark: addr.landmark || '',
            area: addr.area || '',
            city: addr.city || '',
            state: addr.state || '',
            pincode: addr.pincode || addr.postalCode || '',
            postalCode: addr.postalCode || addr.pincode || '',
            formattedAddress: addr.formattedAddress || '',
            lat: addr.lat || null,
            lng: addr.lng || null,
            isDefault: !!addr.isDefault
        });
        setFormErrors({});
        setIsModalOpen(true);
    };

    const validateForm = () => {
        const errs = {};
        const code = (addressForm.pincode || addressForm.postalCode || '').trim();
        if (!code) errs['address.pincode'] = 'Pincode is required';
        else if (!/^\d{6}$/.test(code)) errs['address.pincode'] = 'Enter valid 6-digit PIN code';

        if (!addressForm.houseNumber?.trim()) errs['address.houseNumber'] = 'House/Flat No. required';
        if (!addressForm.road?.trim() && !addressForm.street?.trim()) errs['address.road'] = 'Road/Street required';
        if (!addressForm.city?.trim()) errs['address.city'] = 'City required';
        if (!addressForm.state?.trim()) errs['address.state'] = 'State required';

        setFormErrors(errs);
        if (Object.keys(errs).length > 0) {
            toast.error('Please fill all mandatory address fields (House No, Road/Street, City, State, Pincode)');
            return false;
        }
        return true;
    };

    const handleSaveAddress = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setActionLoading(true);
            let res;
            if (editingAddress?._id) {
                res = await updateSavedAddress(editingAddress._id, addressForm);
            } else {
                res = await createSavedAddress(addressForm);
            }
            if (res.data?.success) {
                toast.success(res.data.message || 'Address saved!');
                setAddresses(res.data.savedAddresses || []);
                setIsModalOpen(false);
            }
        } catch (err) {
            console.error('Error saving address:', err);
            toast.error(err.response?.data?.message || 'Failed to save address');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSetDefault = async (addressId) => {
        try {
            const res = await setDefaultSavedAddress(addressId);
            if (res.data?.success) {
                toast.success('Default address updated!');
                setAddresses(res.data.savedAddresses || []);
            }
        } catch (err) {
            console.error('Error setting default address:', err);
            toast.error(err.response?.data?.message || 'Failed to set default address');
        }
    };

    const handleDeleteAddress = async () => {
        if (!deletingAddressId) return;
        try {
            setActionLoading(true);
            const res = await deleteSavedAddress(deletingAddressId);
            if (res.data?.success) {
                toast.success('Address deleted successfully');
                setAddresses(res.data.savedAddresses || []);
                setDeletingAddressId(null);
            }
        } catch (err) {
            console.error('Error deleting address:', err);
            toast.error(err.response?.data?.message || 'Failed to delete address');
        } finally {
            setActionLoading(false);
        }
    };

    const handleImportPrimaryAddress = async () => {
        if (!profile?.address || (!profile.address.street && !profile.address.city)) return;
        const primary = profile.address;
        const importData = {
            label: 'Home',
            houseNumber: primary.houseNumber || '',
            street: primary.street || primary.road || '',
            road: primary.road || '',
            landmark: primary.landmark || '',
            area: primary.area || '',
            city: primary.city || '',
            state: primary.state || '',
            pincode: primary.pincode || primary.postalCode || '',
            formattedAddress: primary.formattedAddress || '',
            lat: primary.lat || null,
            lng: primary.lng || null,
            isDefault: true
        };
        try {
            setActionLoading(true);
            const res = await createSavedAddress(importData);
            if (res.data?.success) {
                toast.success('Profile address saved as Home!');
                setAddresses(res.data.savedAddresses || []);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to import address');
        } finally {
            setActionLoading(false);
        }
    };

    const hasPrimaryAddressToImport =
        !loading &&
        addresses.length === 0 &&
        profile?.address &&
        (profile.address.city || profile.address.street || profile.address.formattedAddress);

    return (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 text-neutral-600 hover:text-secondary transition-colors shrink-0 flex items-center justify-center"
                            title="Back to Personal Details"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h3 className="text-base font-extrabold text-secondary flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Saved Addresses
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">Manage your service delivery addresses</p>
                    </div>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-primary-dark transition-all self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" /> Add Address
                </button>
            </div>

            {hasPrimaryAddressToImport && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 animate-fade-in">
                    <div>
                        <h4 className="text-xs font-bold">Import Existing Address?</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                            {profile.address.formattedAddress || `${profile.address.street || ''}, ${profile.address.city || ''}`}
                        </p>
                    </div>
                    <button
                        onClick={handleImportPrimaryAddress}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shrink-0"
                    >
                        Save as Home
                    </button>
                </div>
            )}

            {loading ? (
                <div className="space-y-3 py-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 animate-pulse h-20"></div>
                    ))}
                </div>
            ) : addresses.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                    <MapPin className="w-8 h-8 text-neutral-300 mx-auto" />
                    <h4 className="text-sm font-bold text-secondary">No Saved Addresses</h4>
                    <p className="text-xs text-neutral-400 max-w-xs mx-auto">Add your Home, Office or frequently used address for faster booking.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {addresses.map((addr) => (
                        <div
                            key={addr._id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 ${
                                addr.isDefault
                                    ? 'border-primary/40 bg-primary/5 shadow-xs'
                                    : 'border-neutral-100 bg-white hover:border-neutral-200'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-secondary">{addr.label || 'Home'}</span>
                                        {addr.isDefault && (
                                            <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.2 rounded uppercase">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs font-semibold text-secondary leading-relaxed">
                                    {addr.houseNumber ? `${addr.houseNumber}, ` : ''}
                                    {addr.street || addr.road ? `${addr.street || addr.road}, ` : ''}
                                    {addr.area ? `${addr.area}, ` : ''}
                                    {addr.city}, {addr.state} - <span className="font-mono">{addr.pincode || addr.postalCode}</span>
                                </p>
                            </div>
                            <div className="pt-2 border-t border-neutral-100/60 flex items-center justify-between text-xs font-bold">
                                {!addr.isDefault ? (
                                    <button
                                        onClick={() => handleSetDefault(addr._id)}
                                        className="text-neutral-500 hover:text-primary transition-colors flex items-center gap-1 text-[11px]"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Set Default
                                    </button>
                                ) : (
                                    <span className="text-primary text-[11px] flex items-center gap-1">
                                        <Star className="w-3.5 h-3.5 fill-primary text-primary" /> Default
                                    </span>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleOpenEditModal(addr)}
                                        className="p-1 text-neutral-400 hover:text-secondary rounded transition-colors"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingAddressId(addr._id)}
                                        className="p-1 text-neutral-400 hover:text-danger rounded transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AddressModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialAddress={editingAddress}
                onAddressSaved={(_newlyCreated, updatedList) => {
                    if (updatedList) setAddresses(updatedList);
                    else fetchAddresses();
                }}
            />

            {deletingAddressId && (
                <DeleteConfirmModal
                    isOpen={!!deletingAddressId}
                    onClose={() => setDeletingAddressId(null)}
                    onConfirm={handleDeleteAddress}
                    title="Delete Saved Address"
                    message="Are you sure you want to remove this saved address?"
                    actionLoading={actionLoading}
                />
            )}
        </div>
    );
};

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
    const [activeTab, setActiveTab] = useState('profile');
    const [coupons, setCoupons] = useState([]);
    const [couponsLoading, setCouponsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

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
        { id: 'addresses', label: 'Saved Addresses', icon: <MapPin className="w-4 h-4" /> },
        isWalletEnabled && { id: 'payments', label: 'Wallet & Activity', icon: <Wallet className="w-4 h-4" /> },
        { id: 'favorites', label: 'Favorite Providers', icon: <Heart className="w-4 h-4" /> },
        { id: 'offers', label: 'Coupons & Offers', icon: <Gift className="w-4 h-4" /> }
    ].filter(Boolean);

    const quickActions = [
        { id: 'addresses', label: 'Addresses', icon: <MapPin className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600' },
        isWalletEnabled && { id: 'payments', label: 'Wallet', icon: <Wallet className="w-5 h-5" />, color: 'bg-primary/10 text-primary' },
        { id: 'favorites', label: 'Favorites', icon: <Heart className="w-5 h-5" />, color: 'bg-rose-50 text-rose-500' },
        { id: 'offers', label: 'Offers', icon: <Gift className="w-5 h-5" />, color: 'bg-amber-50 text-amber-500' }
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
                            <PersonalDetails
                                profile={profile}
                                setProfile={setProfile}
                                isEditing={isEditing}
                                setIsEditing={setIsEditing}
                                isWalletEnabled={isWalletEnabled}
                                onNavigateTab={(tab) => { setActiveTab(tab); setIsEditing(false); }}
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
                        )}

                        {/* Saved Addresses Standalone Tab */}
                        {activeTab === 'addresses' && (
                            <SavedAddressesSection
                                profile={profile}
                                fetchProfile={fetchProfile}
                                onBack={onBack}
                            />
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

