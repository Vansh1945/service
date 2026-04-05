import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiHome, FiCalendar, FiCreditCard, FiMessageSquare,
    FiBell, FiUser, FiAlertCircle, FiLogOut,
    FiShoppingBag, FiMenu, FiX, FiChevronDown, FiMapPin
} from 'react-icons/fi';
import { FaBolt } from 'react-icons/fa';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';

const CustomerLayout = () => {
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [systemSettings, setSystemSettings] = useState({
        companyName: '',
        logo: null,
        tagline: ''
    });
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser, API, token } = useAuth();

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const response = await fetch(`${API}/system-setting/system-data`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSystemSettings({
                        companyName: data.data?.companyName || '',
                        logo: data.data?.logo,
                        tagline: data.data?.tagline || ''
                    });
                }
            } catch (error) {
                console.error('Failed to fetch system settings:', error);
            }
        };

        if (token) {
            fetchSystemSettings();
        }
    }, [API, token]);

    const navigationItems = [
        { name: 'Services', path: '/customer/services', icon: <FiShoppingBag className="w-5 h-5" /> },
        { name: 'Bookings', path: '/customer/bookings', icon: <FiCalendar className="w-5 h-5" /> },
        { name: 'Feedback', path: '/customer/feedback', icon: <FiMessageSquare className="w-5 h-5" /> },
        { name: 'Complaints', path: '/customer/complaints', icon: <FiAlertCircle className="w-5 h-5" /> },
        { name: 'Profile', path: '/customer/profile', icon: <FiUser className="w-5 h-5" /> },
    ];

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
        setProfileDropdownOpen(false);
    };

    const getUserInitials = () => {
        if (!user?.name) return 'C';
        const names = user.name.split(' ');
        return names.map(name => name[0]).join('').toUpperCase();
    };

    const isActiveRoute = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="min-h-screen bg-background lg:pb-0">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-18 lg:h-20">
                        {/* Logo Section */}
                        <div className="flex items-center space-x-3">
                            <Link to="/customer/services" className="flex items-center space-x-2 transition-transform duration-200 hover:scale-105">
                                {systemSettings.logo ? (
                                    <img
                                        src={systemSettings.logo}
                                        alt={systemSettings.companyName}
                                        className="h-8 md:h-10 lg:h-12 w-auto object-contain mr-2"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-primary shadow-lg">
                                        <FaBolt className="h-4 w-4 lg:h-5 lg:w-5 text-accent" />
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg lg:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                        {systemSettings.companyName || 'SAFEVOLT SOLUTIONS'}
                                    </span>
                                    {systemSettings.tagline && (
                                        <span className="text-xs lg:text-sm text-gray-600 font-medium leading-tight">
                                            {systemSettings.tagline}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center space-x-2 lg:space-x-4">
                            {/* Service Location - Desktop Only */}
                            <div className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200">
                                <FiMapPin className="h-5 w-5 text-accent" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">Service to</span>
                                    <span className="text-sm font-medium text-secondary truncate max-w-28">
                                        {user?.address?.city || user?.city || 'Your Location'}
                                    </span>
                                </div>
                                <FiChevronDown className="h-4 w-4 text-gray-400" />
                            </div>

                            <NotificationBell />

                            {/* Profile Dropdown - Unified for all screens */}
                            <div className="relative">
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
                                        {user?.name || 'Customer'}
                                    </span>
                                    <FiChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {profileDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-background rounded-xl shadow-xl border border-gray-200 py-2 z-[60] animate-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <p className="text-sm font-semibold text-secondary">{user?.name || 'Customer'}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        </div>
                                        <div className="py-2">
                                            {navigationItems.map((item) => (
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
            <main className="min-h-[calc(100vh-80px)]">
                <div className="w-full py-4 lg:py-6">
                    <Outlet />
                </div>
            </main>

            {/* Click outside to close dropdowns */}
            {profileDropdownOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileDropdownOpen(false)}
                />
            )}
        </div>
    );
};

export default CustomerLayout;
