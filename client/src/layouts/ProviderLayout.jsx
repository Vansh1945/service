import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiMenu, FiHome, FiDollarSign,
    FiMessageSquare, FiUser, FiChevronDown,
    FiLogOut, FiCheckCircle,
    FiActivity, FiHeadphones, FiVolumeX, FiAward
} from 'react-icons/fi';
import { FaBolt } from 'react-icons/fa';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';
import { useSocket } from '../socket/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';

import axiosInstance from '../api/axiosInstance';

const ProviderLayout = () => {
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { isAlertRinging, stopBookingAlert, initFCMToken } = useNotification() || {};
    const { user, logoutUser, token, systemSettings: authSystemSettings = {}, activeBranding = {} } = useAuth();
    const logo = activeBranding?.logo || authSystemSettings?.logo || null;
    const companyName = authSystemSettings?.companyName || 'Raj Electrical Services';
    const appName = activeBranding?.appName || 'Provider App';
    const testPassed = user?.testPassed || false;

    const { socket, isConnected } = useSocket();
    const [isOnline, setIsOnline] = useState(() => user?.isOnline ?? true);
    const [activeBookingId, setActiveBookingId] = useState(null);

    // Sync isOnline state when user profile is fetched/loaded
    useEffect(() => {
        if (user && typeof user.isOnline === 'boolean') {
            setIsOnline(user.isOnline);
        }
    }, [user]);



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

    const toggleOnlineStatus = async () => {
        const prevState = isOnline;
        const nextState = !isOnline;
        setIsOnline(nextState); // Optimistic update

        try {
            if (nextState) {
                // Register active FCM token when going online
                if (typeof initFCMToken === 'function') {
                    await initFCMToken(token);
                }
            }

            if (socket && isConnected) {
                socket.emit('provider-toggle-online', { isOnline: nextState });
            } else {
                // Fallback: persist via HTTP API when socket is disconnected
                await axiosInstance.put('/providers/profile', { isOnline: nextState });
            }
            toast.info(`You are now ${nextState ? 'ONLINE' : 'OFFLINE'}`);
        } catch (err) {
            console.error('Toggle online status failed:', err);
            setIsOnline(prevState); // Rollback on failure
            toast.error('Failed to update status. Please try again.');
        }
    };

    // Listen for socket toggle error and rollback
    useEffect(() => {
        if (!socket) return;
        const handleToggleError = (data) => {
            console.error('provider-toggle-online-error:', data);
            // Revert to the opposite of what was requested
            setIsOnline(prev => !prev);
            toast.error(data?.message || 'Failed to update online status.');
        };
        socket.on('provider-toggle-online-error', handleToggleError);
        return () => socket.off('provider-toggle-online-error', handleToggleError);
    }, [socket]);



    const allMenuItems = [
        { name: 'Dashboard', path: '/provider/dashboard', icon: <FiHome className="w-5 h-5" />, requireTest: false },
        { name: 'Booking Requests', path: '/provider/booking-requests', icon: <FiCheckCircle className="w-5 h-5" />, requireTest: true },
        { name: 'Earnings', path: '/provider/earnings', icon: <FiDollarSign className="w-5 h-5" />, requireTest: true },
        { name: 'Refer Partners', path: '/provider/refer-providers', icon: <FiAward className="w-5 h-5" />, requireTest: true },
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

    const isActiveRoute = (path) => {
        return location.pathname === path;
    };

    // Bottom nav: first 4 items for quick access
    const bottomNavItems = [
        { name: 'Home', path: '/provider/dashboard', icon: <FiHome className="w-5 h-5" /> },
        { name: 'Requests', path: '/provider/booking-requests', icon: <FiCheckCircle className="w-5 h-5" />, requireTest: true },
        { name: 'Earnings', path: '/provider/earnings', icon: <FiDollarSign className="w-5 h-5" />, requireTest: true },
        { name: 'Support', path: '/provider/support', icon: <FiHeadphones className="w-5 h-5" /> }
    ].filter(item => !item.requireTest || testPassed);

    // Extra menu items shown inside "Menu" popup (items not in bottom nav)
    const extraMenuItems = [
        { name: 'Profile Settings', path: '/provider/profile', icon: <FiUser className="w-5 h-5" /> },
        { name: 'Refer Partners', path: '/provider/refer-providers', icon: <FiAward className="w-5 h-5" />, requireTest: true },
        { name: 'Feedback Viewer', path: '/provider/feedbacks', icon: <FiMessageSquare className="w-5 h-5" />, requireTest: true },
    ].filter(item => !item.requireTest || testPassed);

    return (
        <div className="min-h-screen bg-gray-50 lg:pb-0">
            {/* Fixed Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-100">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-18 lg:h-20">
                        {/* Logo Section */}
                        <div className="flex flex-1 items-center space-x-2 min-w-0 pr-2">
                            <Link to="/provider/dashboard" className="flex items-center space-x-2 min-w-0">
                                {logo ? (
                                    <img
                                        src={logo}
                                        alt={companyName}
                                        className="flex-shrink-0 h-8 md:h-10 lg:h-12 w-auto object-contain mr-1 md:mr-2"
                                    />
                                ) : (
                                    <FaBolt className="h-8 md:h-10 lg:h-12 w-auto text-primary" />
                                )}
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm sm:text-base md:text-lg lg:text-xl text-secondary truncate leading-tight">
                                        {companyName}
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary truncate">
                                        {appName}
                                    </span>
                                </div>
                            </Link>
                        </div>

                        {/* Duty Toggle - Center on mobile, visible on all */}
                        <div className="flex items-center mr-2 lg:mr-4">
                            <button
                                onClick={toggleOnlineStatus}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 border shadow-sm select-none ${isOnline
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="hidden sm:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                                <span className="sm:hidden">{isOnline ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
                            <NotificationBell />

                            {/* Logout button on mobile */}
                            <button
                                onClick={handleLogout}
                                className="block md:hidden p-1.5 rounded-lg hover:bg-gray-50 text-red-600 transition-all duration-200 focus:outline-none"
                                title="Sign Out"
                            >
                                <FiLogOut className="h-5 w-5" />
                            </button>

                            {/* Profile Dropdown - Desktop/Tablet */}
                            <div className="relative hidden md:block">
                                <button
                                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                    className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent hover:border-gray-200"
                                >
                                    {user?.profilePicUrl ? (
                                        <img
                                            src={user.profilePicUrl}
                                            alt="Profile"
                                            className="w-8 h-8 rounded-full object-cover border-2 border-primary shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-background font-semibold text-xs shadow-md">
                                            {getUserInitials()}
                                        </div>
                                    )}
                                    <span className="hidden sm:block text-sm font-medium text-secondary max-w-20 truncate">
                                        {user?.name || 'Provider'}
                                    </span>
                                    <FiChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {profileDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[60] animate-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-semibold text-secondary">{user?.name || 'Provider'}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        </div>
                                        <div className="py-2">
                                            {menuItems.map((item) => (
                                                <Link
                                                    key={item.name}
                                                    to={item.path}
                                                    className="flex items-center px-4 py-2 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200"
                                                    onClick={() => setProfileDropdownOpen(false)}
                                                >
                                                    {React.cloneElement(item.icon, { className: "mr-3 h-4 w-4" })}
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </div>
                                        <div className="border-t border-gray-100 pt-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-all duration-200"
                                            >
                                                <FiLogOut className="mr-3 h-4 w-4" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="min-h-[calc(100vh-80px)] pt-16 md:pt-18 lg:pt-20 pb-20 md:pb-0">
                <div className="w-full pt-1 pb-4 lg:pt-2 lg:pb-6">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">
                {bottomNavItems.map((item) => {
                    const active = isActiveRoute(item.path) || (item.name === 'Home' && isDashboardActive);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            onClick={() => setMoreMenuOpen(false)}
                        >
                            <div className={`p-1 rounded-lg transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] mt-0.5 font-semibold transition-all ${active ? 'font-bold' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}

                {/* Menu Button */}
                <button
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${moreMenuOpen ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <div className={`p-1 rounded-lg transition-transform duration-200 ${moreMenuOpen ? 'scale-110' : ''}`}>
                        <FiMenu className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] mt-0.5 font-semibold">
                        Menu
                    </span>
                </button>
            </nav>

            {/* Mobile Menu Popup (like CustomerLayout) */}
            {moreMenuOpen && (
                <>
                    <div className="md:hidden fixed bottom-20 right-4 z-50 w-52 bg-white rounded-xl shadow-xl border border-gray-150 py-2 animate-in slide-in-from-bottom-2 duration-200">
                        {extraMenuItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className="flex items-center px-4 py-3 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200"
                                onClick={() => setMoreMenuOpen(false)}
                            >
                                {React.cloneElement(item.icon, { className: "mr-3 h-4 w-4" })}
                                {item.name}
                            </Link>
                        ))}
                        <hr className="border-gray-100 my-1" />
                        <button
                            onClick={() => {
                                setMoreMenuOpen(false);
                                handleLogout();
                            }}
                            className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all duration-200"
                        >
                            <FiLogOut className="mr-3 h-4 w-4" />
                            Sign Out
                        </button>
                    </div>
                    {/* Backdrop to close mobile menu */}
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={() => setMoreMenuOpen(false)}
                    />
                </>
            )}

            {/* Click outside to close profile dropdown */}
            {profileDropdownOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileDropdownOpen(false)}
                />
            )}

            {/* FLOATING MUTE BANNER FOR BOOKING ALERT */}
            {isAlertRinging && (
                <div
                    onClick={stopBookingAlert}
                    className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-white/95 backdrop-blur-sm border border-neutral-100 text-neutral-800 pl-4 pr-3 py-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center justify-between gap-4 w-[92%] max-w-sm cursor-pointer transition-all duration-300 hover:bg-white hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] active:scale-98 select-none"
                    title="Click to Mute Ringtone"
                >
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
                        </span>
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-semibold text-neutral-800 tracking-wide font-inter">Incoming Booking Request</span>
                            <span className="text-[10px] text-neutral-500 font-medium">Click to mute ringtone</span>
                        </div>
                    </div>
                    <button className="flex items-center gap-1.5 px-2.5 py-1 bg-danger-light hover:bg-danger/10 text-danger rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-200">
                        <FiVolumeX className="w-3.5 h-3.5" />
                        <span>Mute</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProviderLayout;