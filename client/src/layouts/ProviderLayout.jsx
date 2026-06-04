import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiMenu, FiHome, FiDollarSign,
    FiMessageSquare, FiUser, FiChevronDown,
    FiLogOut, FiCheckCircle,
    FiActivity, FiHeadphones, FiArrowLeft
} from 'react-icons/fi';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';
import { useSocket } from '../socket/SocketContext';
import { toast } from 'react-toastify';

import * as SystemService from '../services/SystemService';
import axiosInstance from '../api/axiosInstance';

const ProviderLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [systemSettings, setSystemSettings] = useState({
        companyName: '',
        logo: null,
        tagline: ''
    });
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser, token } = useAuth();
    const testPassed = user?.testPassed || false;

    const { socket, isConnected } = useSocket();
    const [isOnline, setIsOnline] = useState(true);
    const [activeBookingId, setActiveBookingId] = useState(null);



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
        const interval = setInterval(checkActiveBookings, 45000); // Check every 45s
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
            {/* Desktop sidebar only */}
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
                        {/* Mobile Header Left - Profile trigger for bottom sheet */}
                        <div className="flex items-center lg:hidden">
                            <button
                                onClick={() => setMoreMenuOpen(true)}
                                className="flex items-center focus:outline-none"
                            >
                                {user?.profilePicUrl ? (
                                    <img
                                        src={user.profilePicUrl}
                                        alt="Profile"
                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm shadow">
                                        {getUserInitials()}
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Page title on desktop only */}
                        <h1 className="hidden lg:block text-xl font-semibold text-secondary">
                            {menuItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
                        </h1>

                        {/* Mobile Header Center: Tactile Partner-style Duty Toggle Switch */}
                        <div className="flex-1 flex justify-center lg:hidden">
                            <div
                                onClick={toggleOnlineStatus}
                                className={`relative inline-flex h-9 w-28 items-center rounded-full cursor-pointer transition-all duration-300 shadow-inner select-none ${isOnline
                                    ? 'bg-primary border border-primary/80'
                                    : 'bg-slate-200 border border-slate-300'}`}
                            >
                                <span className={`text-[10px] font-extrabold tracking-wider w-full text-center transition-all duration-300 select-none ${isOnline ? 'text-white pl-1 pr-6' : 'text-slate-500 pr-1 pl-6'}`}>
                                    {isOnline ? 'DUTY ON' : 'OFFLINE'}
                                </span>
                                <span
                                    className={`absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white transition-all duration-300 shadow flex items-center justify-center ${isOnline ? 'translate-x-20' : 'translate-x-0'}`}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-red-500'}`} />
                                </span>
                            </div>
                        </div>

                        {/* Right side - Actions and profile */}
                        <div className="flex items-center space-x-3">
                            {/* GPS Online Toggle (Desktop only) */}
                            <div className="hidden lg:block">
                                <button
                                    onClick={toggleOnlineStatus}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 border shadow-sm ${isOnline
                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                                    <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                                </button>
                            </div>

                            {/* Notifications */}
                            <NotificationBell />

                            {/* Profile dropdown (Desktop only) */}
                            <div className="relative hidden lg:block">
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
                <main className="flex-1 overflow-auto bg-gray-50 pb-20 lg:pb-0">
                    <div className="p-4 lg:p-6 xl:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Sticky bottom navigation for mobile */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] px-4 py-2.5 flex justify-around items-center">
                {/* Home/Dashboard */}
                <Link
                    to="/provider/dashboard"
                    className={`flex flex-col items-center justify-center space-y-1 transition-colors duration-200 ${(location.pathname === '/provider/dashboard' || location.pathname === '/provider')
                            ? 'text-primary'
                            : 'text-slate-400 hover:text-primary'
                        }`}
                >
                    <FiHome className="w-6 h-6" />
                    <span className="text-[10px] font-semibold font-inter">Home</span>
                </Link>

                {/* Requests */}
                <Link
                    to="/provider/booking-requests"
                    className={`flex flex-col items-center justify-center space-y-1 transition-colors duration-200 ${location.pathname === '/provider/booking-requests'
                            ? 'text-primary'
                            : 'text-slate-400 hover:text-primary'
                        }`}
                >
                    <FiCheckCircle className="w-6 h-6" />
                    <span className="text-[10px] font-semibold font-inter">Requests</span>
                </Link>

                {/* Earnings */}
                <Link
                    to="/provider/earnings"
                    className={`flex flex-col items-center justify-center space-y-1 transition-colors duration-200 ${location.pathname === '/provider/earnings'
                            ? 'text-primary'
                            : 'text-slate-400 hover:text-primary'
                        }`}
                >
                    <FiDollarSign className="w-6 h-6" />
                    <span className="text-[10px] font-semibold font-inter">Earnings</span>
                </Link>

                {/* More/Menu button toggling bottom sheet */}
                <button
                    onClick={() => setMoreMenuOpen(true)}
                    className={`flex flex-col items-center justify-center space-y-1 transition-colors duration-200 ${moreMenuOpen ? 'text-primary' : 'text-slate-400 hover:text-primary'
                        }`}
                >
                    <FiMenu className="w-6 h-6" />
                    <span className="text-[10px] font-semibold font-inter">More</span>
                </button>
            </div>

            {/* Bottom Sheet for Mobile "More" Menu */}
            <div
                className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${moreMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={() => setMoreMenuOpen(false)}
                />

                {/* Bottom sheet panel */}
                <div
                    className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 p-6 pb-8 transition-transform duration-300 ease-out transform ${moreMenuOpen ? 'translate-y-0' : 'translate-y-full'
                        }`}
                >
                    {/* Pull-down handle indicator */}
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                    </div>

                    {/* Header with back arrow and app name */}
                    <div className="flex items-center justify-between mb-4 px-2">
                        <button onClick={() => setMoreMenuOpen(false)} className="text-primary hover:text-primary/80 focus:outline-none">
                            <FiArrowLeft className="w-5 h-5" />
                        </button>
                        <span className="text-lg font-semibold text-primary" title={systemSettings.companyName}>
                            {systemSettings.companyName || 'RAJ ELECTRICAL SERVICES'}
                        </span>
                        {/* Placeholder to balance flex layout */}
                        <div className="w-5 h-5 opacity-0" />
                    </div>

                    {/* Profile Header inside Bottom Sheet */}
                    <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-100">
                        {user?.profilePicUrl ? (
                            <img
                                src={user.profilePicUrl}
                                alt="Profile"
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                                {getUserInitials()}
                            </div>
                        )}
                        <div>
                            <h4 className="text-base font-bold text-secondary">{user?.name || 'Provider'}</h4>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{user?.email || 'provider@example.com'}</p>
                        </div>
                    </div>

                    {/* Menu Options */}
                    <div className="space-y-2">
                        <Link
                            to="/provider/profile"
                            className="flex items-center px-4 py-3.5 text-sm font-semibold text-secondary hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            onClick={() => setMoreMenuOpen(false)}
                        >
                            <FiUser className="w-5 h-5 mr-3 text-primary" />
                            Profile Settings
                        </Link>

                        <Link
                            to="/provider/support"
                            className="flex items-center px-4 py-3.5 text-sm font-semibold text-secondary hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            onClick={() => setMoreMenuOpen(false)}
                        >
                            <FiHeadphones className="w-5 h-5 mr-3 text-primary" />
                            Support & Help
                        </Link>

                        <Link
                            to="/provider/feedbacks"
                            className="flex items-center px-4 py-3.5 text-sm font-semibold text-secondary hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            onClick={() => setMoreMenuOpen(false)}
                        >
                            <FiMessageSquare className="w-5 h-5 mr-3 text-primary" />
                            Feedback Viewer
                        </Link>

                        <hr className="border-gray-100 my-2" />

                        <button
                            onClick={() => {
                                setMoreMenuOpen(false);
                                handleLogout();
                            }}
                            className="w-full flex items-center px-4 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                            <FiLogOut className="w-5 h-5 mr-3 text-red-500" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProviderLayout;