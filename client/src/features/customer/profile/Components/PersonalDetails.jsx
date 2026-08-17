import { useState } from 'react';
import { toast } from 'react-toastify';
import { Camera, Edit2 } from 'lucide-react';
import Processing from '../../../../components/ui-skeletons/Processing';
import { updateProfile, updateprofilepic } from '../../../../services/CustomerService';
import { compressImage } from '../../../../utils/format';

const PersonalDetails = ({ profile, setProfile, isEditing, setIsEditing, isWalletEnabled, children }) => {
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

    return (
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
            {children}

            {/* Editable Info Section */}
            {isEditing && (
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 text-left">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Edit Personal Information</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={profile.name || ''}
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
                                value={profile.phone || ''}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none"
                            />
                        </div>
                        <Processing type="submit" loading={loading} loadingText="Saving Details..." className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-95 transition-opacity">
                            Save Profile Details
                        </Processing>
                    </form>
                </div>
            )}
        </>
    );
};

export default PersonalDetails;
