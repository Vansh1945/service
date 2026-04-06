import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, updateprofilepic } from '../../services/CustomerService';
import AddressSelector from '../../components/AddressSelector';
import {
    User, MapPin, Mail, Phone, Camera, LogOut, Shield,
    ChevronRight, ArrowLeft, CreditCard, Package, Edit2, CheckCircle, Gift
} from 'lucide-react';

const UserProfile = () => {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: { street: '', city: '', state: '', postalCode: '' },
        profilePicUrl: '',
        firstBookingUsed: false,
        totalBookings: 0,
        customDiscount: 0
    });
    const [isEditing, setIsEditing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

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

        const formData = new FormData();
        formData.append('profilePic', selectedFile);

        try {
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
                                { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" />, secondary: true },
                                { id: 'offers', label: 'Offers', icon: <Gift className="w-4 h-4" />, secondary: true },
                                { id: 'support', label: 'Support', icon: <Shield className="w-4 h-4" />, secondary: true, action: () => navigate('/customer/complaints') },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => item.action ? item.action() : setIsEditing(false)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all group mt-1 first:mt-0 ${item.id === 'profile' && !isEditing
                                        ? 'bg-primary/5 text-primary'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`transition-colors ${item.id === 'profile' && !isEditing ? 'text-primary' : 'text-gray-400 group-hover:text-secondary'}`}>
                                            {item.icon}
                                        </div>
                                        <span className={`text-sm font-semibold tracking-tight ${item.id === 'profile' && !isEditing ? 'text-primary' : 'text-gray-600 group-hover:text-secondary'}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-transform ${item.id === 'profile' && !isEditing ? 'opacity-100 translate-x-1' : 'opacity-0'}`} />
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
                                <div className="grid grid-cols-3 gap-2 mt-6 lg:hidden border-t border-gray-50 pt-4">
                                    {[
                                        { label: 'Payments', icon: <CreditCard className="w-4 h-4 text-primary" /> },
                                        { label: 'Offers', icon: <Gift className="w-4 h-4 text-accent" /> },
                                        { label: 'Support', icon: <Shield className="w-4 h-4 text-blue-500" />, action: () => navigate('/customer/complaints') },
                                    ].map((link, idx) => (
                                        <button
                                            key={idx}
                                            onClick={link.action}
                                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors"
                                        >
                                            {link.icon}
                                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{link.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Profile Details Form/View */}
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
                                            <input
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;