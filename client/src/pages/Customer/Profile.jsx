import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';

const UserProfile = () => {
    const { user, token, API, logoutUser } = useAuth();
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: {},
        profilePicUrl: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API}/customer/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch profile');

            const data = await response.json();
            setProfile(data.user);
            setIsLoading(false);
        } catch (error) {
            console.error('Profile fetch error:', error);
            toast.error(error.message);
            setIsLoading(false);
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
        try {
            const response = await fetch(`${API}/customer/profile-update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profile)
            });

            if (!response.ok) throw new Error('Failed to update profile');

            const data = await response.json();
            toast.success('Profile updated successfully!');
            setIsEditing(false);
            setProfile(data.user);
        } catch (error) {
            console.error('Profile update error:', error);
            toast.error(error.message);
        }
    };

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleImageUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            toast.warning('Please select a file first');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('profilePic', selectedFile);

        try {
            const response = await fetch(`${API}/customer/profile-picture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Don't set Content-Type header - let the browser set it
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to upload image');
            }

            toast.success('Profile picture updated!');
            setProfile(prev => ({
                ...prev,
                profilePicUrl: data.profilePicUrl
            }));
            setSelectedFile(null);
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error(error.message);
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {/* Profile Header */}
                    <div className="bg-blue-600 px-6 py-8 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="relative">
                                    <img
                                        src={profile.profilePicUrl || 'https://via.placeholder.com/150'}
                                        alt="Profile"
                                        className="w-20 h-20 rounded-full border-4 border-white object-cover"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                                    <p className="text-blue-100">{profile.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="px-4 py-2 bg-white text-blue-600 rounded-md font-medium hover:bg-blue-50 transition"
                            >
                                {isEditing ? 'Cancel' : 'Edit Profile'}
                            </button>
                        </div>
                    </div>

                    {/* Profile Content */}
                    <div className="px-6 py-8">
                        {isEditing ? (
                            <>
                                <form onSubmit={handleSubmit} className="mb-8">
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={profile.name}
                                                onChange={handleInputChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Email</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={profile.email}
                                                readOnly
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 cursor-not-allowed"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={profile.phone}
                                                onChange={handleInputChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                                required
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Street Address</label>
                                            <input
                                                type="text"
                                                name="street"
                                                value={profile.address?.street || ''}
                                                onChange={handleAddressChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">City</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={profile.address?.city || ''}
                                                onChange={handleAddressChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">State</label>
                                            <input
                                                type="text"
                                                name="state"
                                                value={profile.address?.state || ''}
                                                onChange={handleAddressChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                                            <input
                                                type="text"
                                                name="postalCode"
                                                value={profile.address?.postalCode || ''}
                                                onChange={handleAddressChange}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </form>

                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Update Profile Picture</h3>
                                    <form onSubmit={handleImageUpload} className="flex items-center space-x-4">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-md file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isUploading || !selectedFile}
                                            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white ${isUploading || !selectedFile ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                        >
                                            {isUploading ? 'Uploading...' : 'Upload'}
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                                        <p className="mt-1 text-sm text-gray-900">{profile.name}</p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                                        <p className="mt-1 text-sm text-gray-900">{profile.email}</p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                                        <p className="mt-1 text-sm text-gray-900">{profile.phone || 'Not provided'}</p>
                                    </div>

                                    {profile.address && (
                                        <>
                                            <div className="sm:col-span-2">
                                                <h3 className="text-sm font-medium text-gray-500">Street Address</h3>
                                                <p className="mt-1 text-sm text-gray-900">{profile.address.street || 'Not provided'}</p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-medium text-gray-500">City</h3>
                                                <p className="mt-1 text-sm text-gray-900">{profile.address.city || 'Not provided'}</p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-medium text-gray-500">State</h3>
                                                <p className="mt-1 text-sm text-gray-900">{profile.address.state || 'Not provided'}</p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-medium text-gray-500">Postal Code</h3>
                                                <p className="mt-1 text-sm text-gray-900">{profile.address.postalCode || 'Not provided'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="border-t border-gray-200 pt-6 flex justify-between">
                                    <button
                                        onClick={logoutUser}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;