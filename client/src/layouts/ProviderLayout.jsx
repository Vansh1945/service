import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiMenu, FiX, FiHome, FiCalendar, FiDollarSign,
    FiFileText, FiMessageSquare, FiUser, FiChevronDown,
    FiLogOut, FiBell, FiCreditCard, FiCheckCircle,
    FiActivity, FiSettings, FiHeadphones
} from 'react-icons/fi';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';
import { useSocket } from '../socket/SocketContext';
import { toast } from 'react-toastify';

import * as SystemService from '../services/SystemService';
import axiosInstance from '../api/axiosInstance';
import { detectCurrentLocation, toLegacyAddressFields } from '../utils/format';

const ProviderLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [systemSettings, setSystemSettings] = useState({
        companyName: '',
        logo: null,
        tagline: ''
    });
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser, API, token, refreshUser } = useAuth();
    const testPassed = user?.testPassed || false;

    const { socket, isConnected } = useSocket();
    const [isOnline, setIsOnline] = useState(true);
    const [activeBookingId, setActiveBookingId] = useState(null);
    const locationRequestedRef = React.useRef(false);

    // Auto-detect and update provider location on app open - DISABLED: Overwrites permanent registered address in profile automatically.
    /*
    useEffect(() => {
        if (!token || !user || locationRequestedRef.current) return;
        locationRequestedRef.current = true;

        detectCurrentLocation({ maximumAge: 60000 })
            .then(async ({ latitude, longitude, address }) => {
                const fields = toLegacyAddressFields({ ...address, lat: latitude, lng: longitude });
                const formData = new FormData();
                formData.append('updateType', 'address');
                formData.append('lat', latitude);
                formData.append('lng', longitude);
                formData.append('street', fields.street || user.address?.street || '');
                formData.append('city', fields.city || user.address?.city || '');
                formData.append('state', fields.state || user.address?.state || '');
                formData.append('postalCode', fields.postalCode || user.address?.postalCode || '');
                formData.append('country', fields.country || user.address?.country || 'India');
                if (fields.formattedAddress) formData.append('formattedAddress', fields.formattedAddress);

                await axiosInstance.put('/provider/profile', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                await refreshUser();
            })
            .catch((err) => {
                console.warn('Provider geolocation sync skipped:', err.message);
            });
    }, [token, user]);
    */

    // Fetch active bookings to see if we need tracking
    useEffect(() => {
        if (!isOnline || !token) return;

        const checkActiveBookings = async () => {
            try {
                const [acceptedRes, progressRes] = await Promise.all([
                    axiosInstance.get('/booking/provider/status/accepted').catch(() => ({ data: { data: [] } })),
                    axiosInstance.get('/booking/provider/status/in-progress').catch(() => ({ data: { data: [] } }))
                ]);
                const accepted = acceptedRes.data?.data || [];
                const inProgress = progressRes.data?.data || [];
                const active = [...accepted, ...inProgress][0];
                if (active) {
                    setActiveBookingId(active._id);
                } else {
                    setActiveBookingId(null);
                }
            } catch (err) {
                console.error("Error checking active bookings for tracking:", err);
            }
        };

        checkActiveBookings();
        const interval = setInterval(checkActiveBookings, 15000); // Check every 15s
        return () => clearInterval(interval);
    }, [isOnline, token]);

    // Geolocation Watcher Loop
    useEffect(() => {
        if (!isOnline || !activeBookingId || !socket || !isConnected) return;

        let watchId = null;
        let lastUpdatedTime = 0;

        const startWatching = () => {
            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const now = Date.now();
                        // Battery/network optimization: emit at most once every 4.8 seconds
                        if (now - lastUpdatedTime >= 4800) {
                            const { latitude, longitude } = position.coords;
                            console.log("Sending provider live GPS update:", { latitude, longitude });
                            socket.emit('provider-location-update', {
                                bookingId: activeBookingId,
                                latitude,
                                longitude
                            });
                            lastUpdatedTime = now;
                        }
                    },
                    (error) => {
                        console.error("GPS Watcher error:", error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            }
        };

        startWatching();

        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [isOnline, activeBookingId, socket, isConnected]);

    const toggleOnlineStatus = () => {
        const nextState = !isOnline;
        setIsOnline(nextState);
        if (socket) {
            socket.emit('provider-toggle-online', { isOnline: nextState });
        }
        toast.info(`You are now ${nextState ? 'ONLINE' : 'OFFLINE'}`);
    };

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const cached = localStorage.getItem('branding_provider');
                if (cached) {
                    const data = JSON.parse(cached);
                    setSystemSettings({
                        companyName: data.appName || 'RAJ ELECTRICAL SERVICES',
                        logo: data.logo || null,
                        tagline: data.description || ''
                    });
                }

                const response = await SystemService.getBrandingSettings('provider');
                if (response.data?.success) {
                    const data = response.data.data;
                    setSystemSettings({
                        companyName: data.appName || 'RAJ ELECTRICAL SERVICES',
                        logo: data.logo || null,
                        tagline: data.description || ''
                    });
                    localStorage.setItem('branding_provider', JSON.stringify(data));
                }
            } catch (error) {
                console.error('Failed to fetch system settings:', error);
            }
        };

        if (token) {
            fetchSystemSettings();
        }
    }, [token]);

    useEffect(() => {
        const handleBrandingUpdate = (e) => {
            if (e.detail?.role === 'provider') {
                const data = e.detail.data;
                setSystemSettings({
                    companyName: data.appName || 'Raj Electrical Services',
                    logo: data.logo || null,
                    tagline: data.description || ''
                });
            }
        };
        window.addEventListener('brandingUpdated', handleBrandingUpdate);
        return () => window.removeEventListener('brandingUpdated', handleBrandingUpdate);
    }, []);

    const allMenuItems = [
        { name: 'Dashboard', path: '/provider/dashboard', icon: <FiHome className="w-5 h-5" />, requireTest: false },
        { name: 'Booking Requests', path: '/provider/booking-requests', icon: <FiCheckCircle className="w-5 h-5" />, requireTest: true },
        { name: 'Earnings', path: '/provider/earnings', icon: <FiDollarSign className="w-5 h-5" />, requireTest: true },
        { name: 'Feedback Viewer', path: '/provider/feedbacks', icon: <FiMessageSquare className="w-5 h-5" />, requireTest: true },
        { name: 'Support & Help', path: '/provider/support', icon: <FiHeadphones className="w-5 h-5" />, requireTest: false },
        { name: 'Test', path: '/provider/test', icon: <FiActivity className="w-5 h-5" />, requireTest: false }
    ];

    // Adjust menu items based on test status
    const menuItems = allMenuItems.filter(item => {
        // If it's the Test item and test is passed, hide it
        if (item.name === 'Test' && testPassed) return false;
        // Check other permissions
        return !item.requireTest || testPassed;
    });

    const isDashboardActive = location.pathname === '/provider' || location.pathname === '/provider/dashboard';

    const handleLogout = () => {
        logoutUser();
        setProfileDropdownOpen(false);
        navigate('/login');
    };

    const getUserInitials = () => {
        if (!user?.name) return 'P';
        const names = user.name.split(' ');
        return names.map(name => name[0]).join('').toUpperCase();
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Mobile sidebar overlay */}
            <div
                className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />

                {/* Mobile sidebar */}
                <div className={`relative flex flex-col w-80 max-w-xs h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}>
                    {/* Mobile header */}
                    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                        <div className="flex items-center flex-1 min-w-0 pr-2">
                            {systemSettings.logo && (
                                <img
                                    src={systemSettings.logo}
                                    alt={systemSettings.companyName}
                                    className="h-8 w-auto object-contain mr-2 flex-shrink-0"
                                />
                            )}
                            <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter truncate">
                                {systemSettings.companyName || 'RAJ ELECTRICAL SERVICES'}
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 flex-shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-secondary transition-colors"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mobile navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive);
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                        : 'text-secondary hover:bg-primary/10 hover:text-primary'
                                        }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <span className="mr-3">{item.icon}</span>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <div className="flex flex-col w-72 bg-white border-r border-gray-200 shadow-sm">
                    {/* Desktop header */}
                    <div className="flex items-center px-6 py-6 border-b border-gray-200">
                        <div className="flex items-center">
                            {systemSettings.logo && (
                                <img
                                    src={systemSettings.logo}
                                    alt={systemSettings.companyName}
                                    className="h-10 w-auto object-contain mr-3"
                                />
                            )}
                            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter">
                                {systemSettings.companyName || 'RAJ ELECTRICAL SERVICES'}
                            </span>
                        </div>
                    </div>

                    {/* Desktop navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive);
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${isActive
                                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                        : 'text-secondary hover:bg-primary/10 hover:text-primary'
                                        }`}
                                >
                                    <span className="mr-3">{item.icon}</span>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top navigation bar */}
                <header className="bg-white border-b border-gray-200 shadow-sm z-10">
                    <div className="flex items-center justify-between px-4 py-4 lg:px-6">
                        {/* Left side - Mobile menu button */}
                        <div className="flex items-center">
                            <button
                                type="button"
                                className="p-2 rounded-lg text-secondary lg:hidden hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <FiMenu className="w-6 h-6" />
                            </button>

                            {/* Page title on mobile */}
                            <h1 className="ml-3 text-xl font-semibold text-secondary lg:hidden">
                                {menuItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
                            </h1>
                        </div>

                        {/* Right side - Actions and profile */}
                        <div className="flex items-center space-x-3">
                            {/* GPS Online Toggle */}
                            <button
                                onClick={toggleOnlineStatus}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 border shadow-sm ${isOnline 
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                                <span className="hidden sm:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                            </button>

                            {/* Notifications */}
                            <NotificationBell />

                            {/* Profile dropdown */}
                            <div className="relative">
                                <button
                                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                >
                                    {user?.profilePicUrl ? (
                                        <img
                                            src={user.profilePicUrl}
                                            alt="Profile"
                                            className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                                            {getUserInitials()}
                                        </div>
                                    )}
                                    <div className="hidden md:block text-left">
                                        <p className="text-sm font-medium text-secondary">
                                            {user?.name || 'Provider'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {user?.email || 'provider@example.com'}
                                        </p>
                                    </div>
                                    <FiChevronDown
                                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${profileDropdownOpen ? 'transform rotate-180' : ''
                                            }`}
                                    />
                                </button>

                                {/* Dropdown menu */}
                                {profileDropdownOpen && (
                                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg py-2 z-20 border border-gray-200 animate-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-medium text-secondary">
                                                {user?.name || 'Provider'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {user?.email || 'provider@example.com'}
                                            </p>
                                        </div>

                                        <Link
                                            to="/provider/profile"
                                            className="flex items-center px-4 py-3 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                                            onClick={() => setProfileDropdownOpen(false)}
                                        >
                                            <FiUser className="w-4 h-4 mr-3" />
                                            Profile Settings
                                        </Link>


                                        <hr className="my-2 border-gray-100" />

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <FiLogOut className="w-4 h-4 mr-3" />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-auto bg-gray-50">
                    <div className="p-4 lg:p-6 xl:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProviderLayout;