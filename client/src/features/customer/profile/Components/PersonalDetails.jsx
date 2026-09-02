import { useState } from 'react';
import { toast } from '../../../../components/ui/Toast';

import { Camera, Edit2, User, Mail, Phone, ShieldCheck, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import Processing from '../../../../components/ui/Processing';
import { updateProfile, updateprofilepic } from '../../../../services/CustomerService';
import { compressImage } from '../../../../utils/format';

const PersonalDetails = ({ profile, setProfile, isEditing, setIsEditing, isWalletEnabled, onNavigateTab, children }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);

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
            toast.error(error.message || 'Failed to update profile');
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
            toast.error(error.message || 'Failed to upload profile picture');
        }
    };

    const defaultAddress = profile?.address;
    const hasDefaultAddress = defaultAddress && (defaultAddress.formattedAddress || defaultAddress.city || defaultAddress.street || defaultAddress.houseNumber);

    return (
        <div className="space-y-4 text-left">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden relative">
                <div className="h-12 bg-gradient-to-r from-primary/20 via-primary/10 to-teal-50" />

                {/* Edit Profile Text Link (Top Right) */}
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="absolute top-3.5 right-4 text-xs font-extrabold text-primary hover:underline flex items-center gap-1 transition-all"
                    title={isEditing ? 'Cancel Editing' : 'Edit Profile'}
                >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
                </button>

                <div className="px-5 pb-5 -mt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="relative group shrink-0">
                            <img
                                src={profile.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&background=0D9488&color=fff`}
                                alt="Customer profile photo"
                                loading="lazy"
                                decoding="async"
                                width={64}
                                height={64}
                                className="w-16 h-16 rounded-2xl border-4 border-white object-cover shadow-md bg-neutral-50"
                            />
                            <label className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-1.5 cursor-pointer shadow-md hover:bg-primary/95 transition-all">
                                <Camera className="w-3.5 h-3.5" />
                                <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                            </label>
                        </div>
                        <div className="min-w-0 pr-8 sm:pr-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-extrabold text-secondary truncate">{profile.name}</h2>
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-100">
                                    <Sparkles className="w-3 h-3 text-teal-600" /> Verified Account
                                </span>
                            </div>
                            <p className="text-xs text-neutral-400 font-semibold mt-0.5 truncate">{profile.email}</p>
                            <p className="text-xs text-neutral-500 font-semibold mt-0.5">{profile.phone || 'Add phone number'}</p>
                            {selectedFile && (
                                <button onClick={handleImageUpload} className="mt-1.5 text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-bold hover:opacity-90 transition-opacity">
                                    Upload Pic
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Navigation Grid */}
            {children}

            {/* Editing Mode Form */}
            {isEditing ? (
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 animate-fade-in">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
                        <User className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-black text-secondary uppercase tracking-widest">Edit Personal Information</h3>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={profile.name || ''}
                                onChange={handleInputChange}
                                className="w-full px-3.5 py-2.5 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none bg-neutral-50/50"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={profile.phone || ''}
                                onChange={handleInputChange}
                                className="w-full px-3.5 py-2.5 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none bg-neutral-50/50"
                            />
                        </div>
                        <Processing type="submit" loading={loading} loadingText="Saving Details..." className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-95 transition-opacity shadow-sm">
                            Save Profile Details
                        </Processing>
                    </form>
                </div>
            ) : (
                /* Information Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Personal Details Card */}
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                            <h3 className="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-2">
                                <User className="w-4 h-4 text-primary" />
                                Account Details
                            </h3>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                                Edit <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-neutral-50 rounded-xl text-neutral-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Full Name</p>
                                    <p className="text-xs font-extrabold text-secondary mt-0.5">{profile.name || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-neutral-50 rounded-xl text-neutral-400">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email Address</p>
                                    <p className="text-xs font-extrabold text-secondary mt-0.5 truncate">{profile.email || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-neutral-50 rounded-xl text-neutral-400">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Mobile Number</p>
                                    <p className="text-xs font-extrabold text-secondary mt-0.5">{profile.phone || 'Not added yet'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Primary Address / Security Card */}
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                                <h3 className="text-xs font-black text-secondary uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-emerald-600" />
                                    Primary Address
                                </h3>
                                {onNavigateTab && (
                                    <button
                                        onClick={() => onNavigateTab('addresses')}
                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                    >
                                        Manage <ChevronRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="pt-3">
                                {hasDefaultAddress ? (
                                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-secondary">{defaultAddress.label || 'Home'}</span>
                                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded uppercase">Default</span>
                                        </div>
                                        <p className="text-xs font-semibold text-secondary leading-relaxed">
                                            {defaultAddress.houseNumber ? `${defaultAddress.houseNumber}, ` : ''}
                                            {defaultAddress.street || defaultAddress.road ? `${defaultAddress.street || defaultAddress.road}, ` : ''}
                                            {defaultAddress.area ? `${defaultAddress.area}, ` : ''}
                                            {defaultAddress.city}, {defaultAddress.state} - <span className="font-mono">{defaultAddress.pincode || defaultAddress.postalCode}</span>
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-neutral-50 rounded-xl text-center space-y-1.5">
                                        <p className="text-xs font-bold text-neutral-400">No primary address saved</p>
                                        {onNavigateTab && (
                                            <button
                                                onClick={() => onNavigateTab('addresses')}
                                                className="text-xs font-bold text-primary hover:underline inline-block"
                                            >
                                                + Add Address
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Security Notice */}
                        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-400">
                            <span className="flex items-center gap-1 text-[11px] text-teal-700 font-bold">
                                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Account Protected & Verified
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalDetails;
