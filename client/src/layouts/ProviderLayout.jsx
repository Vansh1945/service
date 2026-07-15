import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiMenu, FiHome, FiDollarSign, FiMessageSquare, FiUser, FiChevronDown,
    FiLogOut, FiCheckCircle, FiActivity, FiHeadphones, FiVolumeX, FiAward,
    FiCalendar, FiChevronRight, FiArrowLeft, FiFileText, FiSettings, FiCreditCard
} from 'react-icons/fi';
import { FaBolt } from 'react-icons/fa';
import { useAuth } from '../context/auth';
import { DEFAULT_COMPANY_NAME, DEFAULT_PROVIDER_APP_NAME, getUserInitials, useClickOutside, UserAvatar } from './CustomerLayout';
import NotificationBell from '../components/NotificationBell';
import { useSocket } from '../socket/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance';
import { getProviderAverageRating } from '../services/FeedbackService';
import { getBookingsByStatus } from '../services/BookingService';

const ProviderLayout = () => {
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { isAlertRinging, stopBookingAlert, initFCMToken } = useNotification() || {};
    const { user, logoutUser, token, systemSettings: authSystemSettings = {}, activeBranding = {} } = useAuth();
    const logo = activeBranding?.logo || authSystemSettings?.logo || null;
    const companyName = authSystemSettings?.companyName || DEFAULT_COMPANY_NAME;
    const appName = activeBranding?.appName || DEFAULT_PROVIDER_APP_NAME;
    const testPassed = user?.testPassed || false;

    const { socket, isConnected } = useSocket();
    const [isOnline, setIsOnline] = useState(() => user?.isOnline ?? true);
    const [activeBookingId, setActiveBookingId] = useState(null);
    const [averageRating, setAverageRating] = useState(0);

    const dropdownRef = useRef(null);
    const avatarRef = useRef(null);

    useEffect(() => {
        if (user && typeof user.isOnline === 'boolean') {
            setIsOnline(user.isOnline);
        }
    }, [user]);

    useEffect(() => {
        if (user && token) {
            getProviderAverageRating()
                .then(res => {
                    if (res.data?.success && res.data?.data) {
                        setAverageRating(res.data.data.averageRating || 0);
                    }
                })
                .catch(err => console.error("Error fetching provider rating:", err));
        }
    }, [user, token]);

    useClickOutside(dropdownRef, avatarRef, () => setProfileDropdownOpen(false));

    useEffect(() => {
        if (!isOnline || !token) return;

        const checkActiveBookings = async () => {
            try {
                const [acceptedRes, progressRes] = await Promise.all([
                    getBookingsByStatus('accepted').catch(() => ({ data: { data: [] } })),
                    getBookingsByStatus('in-progress').catch(() => ({ data: { data: [] } }))
                ]);
                const accepted = acceptedRes.data?.data || [];
                const inProgress = progressRes.data?.data || [];
                const active = [...accepted, ...inProgress][0];
                setActiveBookingId(active ? active._id : null);
            } catch (err) {
                console.error("Error checking active bookings for tracking:", err);
            }
        };

        checkActiveBookings();
        const interval = setInterval(checkActiveBookings, 45000);
        return () => clearInterval(interval);
    }, [isOnline, token]);

    useEffect(() => {
        if (!isOnline || !activeBookingId || !socket || !isConnected) return;

        let watchId = null;
        let lastUpdatedTime = 0;

        const startWatching = () => {
            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const now = Date.now();
                        if (now - lastUpdatedTime >= 4800) {
                            const { latitude, longitude } = position.coords;
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
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        };

        startWatching();
        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        };
    }, [isOnline, activeBookingId, socket, isConnected]);

    const toggleOnlineStatus = async () => {
        const prevState = isOnline;
        const nextState = !isOnline;
        setIsOnline(nextState);

        try {
            if (nextState && typeof initFCMToken === 'function') {
                await initFCMToken(token);
            }

            if (socket && isConnected) {
                socket.emit('provider-toggle-online', { isOnline: nextState });
            } else {
                await axiosInstance.put('/providers/profile', { isOnline: nextState });
            }
            toast.info(`You are now ${nextState ? 'ONLINE' : 'OFFLINE'}`);
        } catch (err) {
            console.error('Toggle online status failed:', err);
            setIsOnline(prevState);
            toast.error('Failed to update status. Please try again.');
        }
    };

    useEffect(() => {
        if (!socket) return;
        const handleToggleError = (data) => {
            setIsOnline(prev => !prev);
            toast.error(data?.message || 'Failed to update online status.');
        };
        socket.on('provider-toggle-online-error', handleToggleError);
        return () => socket.off('provider-toggle-online-error', handleToggleError);
    }, [socket]);

    const handleLogout = () => {
        logoutUser();
        setProfileDropdownOpen(false);
        setMoreMenuOpen(false);
        navigate('/login');
    };

    const isActiveRoute = (path) => {
        if (path === '/provider/dashboard' && (location.pathname === '/provider' || location.pathname === '/provider/dashboard')) {
            return true;
        }
        return location.pathname === path;
    };

    // Flat menu list containing Profile Settings, Job Calendar, Refer Partners, Customer Ratings
    const getMenuItems = () => {
        const items = [
            { name: 'Profile Settings', path: '/provider/profile', icon: <FiUser className="w-5 h-5" /> }
        ];

        if (!user?.requireTest || testPassed) {
            items.push({ name: 'Job Calendar', path: '/provider/calendar', icon: <FiCalendar className="w-5 h-5" /> });
            items.push({ name: 'Refer Partners', path: '/provider/refer-providers', icon: <FiAward className="w-5 h-5" /> });
            items.push({ name: 'Customer Ratings', path: '/provider/feedbacks', icon: <FiMessageSquare className="w-5 h-5" /> });
        }

        if (user && !testPassed) {
            items.push({ name: 'Skill Test', path: '/provider/test', icon: <FiActivity className="w-5 h-5" /> });
        }

        return items;
    };

    const getDesktopNavItems = () => {
        const navItems = [
            { name: 'Dashboard', path: '/provider/dashboard', icon: <FiHome className="w-5 h-5" /> }
        ];
        if (!user?.requireTest || testPassed) {
            navItems.push(
                { name: 'Jobs', path: '/provider/booking-requests', icon: <FiFileText className="w-5 h-5" /> },
                { name: 'Calendar', path: '/provider/calendar', icon: <FiCalendar className="w-5 h-5" /> },
                { name: 'Wallet', path: '/provider/earnings', icon: <FiCreditCard className="w-5 h-5" /> }
            );
        }
        return navItems;
    };

    const renderDesktopMenu = () => (
        <div className="space-y-1 text-left">
            {/* Navigation Links */}
            <div className="space-y-0.5">
                {getDesktopNavItems().map((item) => {
                    const active = isActiveRoute(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setProfileDropdownOpen(false)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all relative ${active ? 'bg-primary/10 text-primary' : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                {React.cloneElement(item.icon, { className: 'w-4 h-4' })}
                                {item.name}
                            </span>
                            {active && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 bg-primary rounded-r" />
                            )}
                            <FiChevronRight className="w-3 h-3 text-neutral-400" />
                        </Link>
                    );
                })}
            </div>
            {/* Settings Links */}
            <div className="pt-1.5 border-t border-neutral-100 mt-1.5 space-y-0.5">
                {getMenuItems()
                    .filter(item => !getDesktopNavItems().some(navItem => navItem.path === item.path))
                    .map((item) => {
                    const active = isActiveRoute(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setProfileDropdownOpen(false)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all relative ${active ? 'bg-primary/10 text-primary' : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                {React.cloneElement(item.icon, { className: 'w-4 h-4' })}
                                {item.name}
                            </span>
                            <FiChevronRight className="w-3 h-3 text-neutral-400" />
                        </Link>
                    );
                })}
            </div>
            {/* Logout */}
            <div className="pt-1.5 border-t border-neutral-100 mt-1.5">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-extrabold text-danger hover:bg-danger/10 transition-all text-left"
                >
                    <span className="flex items-center gap-2"><FiLogOut className="w-4 h-4" /> Sign Out</span>
                    <FiChevronRight className="w-3 h-3 text-neutral-400" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background lg:pb-0">
            {/* Desktop / Tablet Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-neutral-100 shadow-sm transition-all duration-300">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Left Section */}
                        <div className="flex items-center space-x-4 min-w-0 pr-2">
                            <Link to="/provider/dashboard" className="flex items-center space-x-2.5 min-w-0 group">
                                {logo ? (
                                    <img src={logo} alt={companyName} className="flex-shrink-0 h-8 md:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
                                ) : (
                                    <FaBolt className="h-8 md:h-10 w-auto text-primary transition-transform duration-300 group-hover:rotate-12" />
                                )}
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm sm:text-base md:text-md text-secondary truncate leading-tight tracking-tight">{companyName}</span>
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary truncate">{appName}</span>
                                </div>
                            </Link>

                        </div>

                        {/* Center Desktop Nav removed — all links moved into avatar dropdown */}

                        {/* Right Section */}
                        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                            <button
                                onClick={toggleOnlineStatus}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 border shadow-sm select-none ${isOnline
                                    ? 'bg-success/10 text-success border-success/20 hover:bg-success/20'
                                    : 'bg-danger/10 text-danger border-danger/20 hover:bg-danger/20'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </button>

                            <NotificationBell />

                            <button onClick={handleLogout} className="block md:hidden p-2 rounded-xl text-danger hover:bg-danger-light/10 transition-all duration-200" title="Sign Out">
                                <FiLogOut className="h-5 w-5" />
                            </button>

                            <div className="relative hidden md:block">
                                <button
                                    ref={avatarRef}
                                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                    className="flex items-center space-x-2.5 p-1 rounded-full md:p-1.5 md:bg-neutral-50 md:hover:bg-neutral-100 transition-all duration-200 focus:outline-none border border-transparent md:border-neutral-100"
                                >
                                    <UserAvatar user={user} size="w-8 h-8" fallbackChar="P" />
                                    <span className="hidden sm:block text-sm font-semibold text-secondary max-w-20 truncate">{user?.name || 'Provider'}</span>
                                    <FiChevronDown className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {profileDropdownOpen && (
                                    <div ref={dropdownRef} className="absolute right-0 mt-2.5 w-[300px] bg-white rounded-2xl shadow-xl border border-neutral-100 p-3 z-[60] animate-in fade-in slide-in-from-top-2 duration-200 space-y-2.5">
                                        <div className="flex items-center gap-2.5 pb-2.5 border-b border-neutral-100">
                                            <UserAvatar user={user} size="w-9 h-9" fallbackChar="P" />
                                            <div className="flex flex-col min-w-0 text-left gap-0.5">
                                                <p className="text-xs font-bold text-secondary truncate leading-none">{user?.name || 'Provider'}</p>
                                                <p className="text-[10px] text-neutral-400 truncate leading-none">{user?.email}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${isOnline ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                                                    </span>
                                                    <span className="flex items-center text-[9px] font-bold text-neutral-500 gap-0.5">
                                                        <span className="text-[11px] text-yellow-500 tracking-tight">{'★'.repeat(Math.round(averageRating || 5))}{'☆'.repeat(5 - Math.round(averageRating || 5))}</span>
                                                        {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
                                                    </span>
                                                </div>
                                                {user?.providerId && (
                                                    <p className="text-[9px] font-bold text-neutral-400 leading-none">ID • {user.providerId}</p>
                                                )}
                                            </div>
                                        </div>
                                        {renderDesktopMenu()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="min-h-[calc(100vh-80px)] pt-16 md:pt-20 pb-20 md:pb-6">
                <div className="w-full pt-1 pb-4">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-100 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex justify-around items-center h-16 px-2">
                <Link to="/provider/dashboard" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/provider/dashboard') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMoreMenuOpen(false)}>
                    <FiHome className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Dashboard</span>
                    {isActiveRoute('/provider/dashboard') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                {(!user?.requireTest || testPassed) && (
                    <Link to="/provider/booking-requests" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/provider/booking-requests') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMoreMenuOpen(false)}>
                        <FiCheckCircle className="w-5 h-5" />
                        <span className="text-[10px] mt-0.5 font-semibold">Jobs</span>
                        {isActiveRoute('/provider/booking-requests') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                    </Link>
                )}

                {(!user?.requireTest || testPassed) && (
                    <Link to="/provider/earnings" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/provider/earnings') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMoreMenuOpen(false)}>
                        <FiDollarSign className="w-5 h-5" />
                        <span className="text-[10px] mt-0.5 font-semibold">Earnings</span>
                        {isActiveRoute('/provider/earnings') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                    </Link>
                )}

                <Link to="/provider/support" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/provider/support') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMoreMenuOpen(false)}>
                    <FiHeadphones className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Support</span>
                    {isActiveRoute('/provider/support') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                <button onClick={() => setMoreMenuOpen(true)} className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${moreMenuOpen ? 'text-primary' : 'text-neutral-400'}`}>
                    <FiMenu className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Menu</span>
                    {moreMenuOpen && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </button>
            </nav>

            {/* Mobile Bottom Sheet (Blinkit Style - Redesigned) */}
            {moreMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300" onClick={() => setMoreMenuOpen(false)} />
                    <div className="relative bg-white rounded-t-[24px] shadow-2xl border-t border-neutral-100 max-h-[85vh] overflow-y-auto z-10 transition-transform duration-300 transform translate-y-0 pb-6 px-4">
                        {/* Drag handle */}
                        <div className="flex items-center justify-between pt-3 pb-2.5">
                            <button onClick={() => setMoreMenuOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500" aria-label="Close menu">
                                <FiArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-1 bg-neutral-200 rounded-full" />
                            <div className="w-7" />
                        </div>

                        {/* Premium Compact User Card */}
                        <Link to="/provider/profile" onClick={() => setMoreMenuOpen(false)} className="mb-4 p-3 rounded-xl border border-neutral-100 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <UserAvatar user={user} size="w-9 h-9" fallbackChar="P" />
                                <div className="flex flex-col min-w-0 text-left gap-1">
                                    <p className="text-xs font-bold text-secondary truncate leading-none">{user?.name || 'Provider'}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${isOnline ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                        <span className="flex items-center text-[9px] font-bold text-neutral-500 gap-0.5">
                                            <span className="text-[11px] text-yellow-500 tracking-tight">{'★'.repeat(Math.round(averageRating || 5))}{'☆'.repeat(5 - Math.round(averageRating || 5))}</span>
                                            {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
                                        </span>
                                    </div>
                                    {user?.providerId && (
                                        <p className="text-[9px] font-bold text-neutral-400 leading-none">ID • {user.providerId}</p>
                                    )}
                                </div>
                            </div>
                            <FiChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                        </Link>

                        {/* Flat Menu Item Rows (No Categories) */}
                        <div className="space-y-1 text-left">
                            {getMenuItems().map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => setMoreMenuOpen(false)}
                                    className="flex items-center justify-between px-3 py-2.5 h-11 rounded-lg bg-neutral-50/50 hover:bg-neutral-50 transition-all"
                                >
                                    <span className="flex items-center gap-2.5 text-xs font-bold text-secondary">
                                        {React.cloneElement(item.icon, { className: 'w-4.5 h-4.5 text-neutral-400' })}
                                        {item.name}
                                    </span>
                                    <FiChevronRight className="w-4 h-4 text-neutral-400" />
                                </Link>
                            ))}
                        </div>

                        {/* Logout at bottom */}
                        <div className="pt-3 mt-4 border-t border-neutral-100 text-left">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg font-bold bg-danger/5 hover:bg-danger hover:text-white text-danger transition-all duration-150"
                            >
                                <FiLogOut className="w-4.5 h-4.5" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
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
                    <button className="flex items-center gap-1.5 px-2.5 py-1 bg-danger-light/10 hover:bg-danger/15 text-danger rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-200">
                        <FiVolumeX className="w-3.5 h-3.5" />
                        <span>Mute</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProviderLayout;