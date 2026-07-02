import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiCalendar, FiMessageSquare,
    FiUser, FiAlertCircle, FiLogOut,
    FiShoppingBag, FiMenu, FiChevronDown, FiMapPin, FiGift
} from 'react-icons/fi';
import { FaBolt } from 'react-icons/fa';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';
import SearchBar from '../pages/Customer/components/Customer-SearchBar';


const CustomerLayout = () => {
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser, systemSettings: authSystemSettings = {}, activeBranding = {} } = useAuth();

    const logo = activeBranding?.logo || authSystemSettings?.logo || null;
    const companyName = authSystemSettings?.companyName || 'Raj Electrical Services';
    const appName = activeBranding?.appName || 'Customer App';

    const navigationItems = [
        { name: 'Services', path: '/customer/services', icon: <FiShoppingBag className="w-5 h-5" /> },
        { name: 'Bookings', path: '/customer/bookings', icon: <FiCalendar className="w-5 h-5" /> },
        { name: 'Feedback', path: '/customer/feedback', icon: <FiMessageSquare className="w-5 h-5" /> },
        { name: 'Complaints', path: '/customer/complaints', icon: <FiAlertCircle className="w-5 h-5" /> },
        { name: 'Refer & Earn', path: '/customer/refer-earn', icon: <FiGift className="w-5 h-5" /> },
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
            <header className="fixed top-0 left-0 right-0 z-50 bg-background shadow-sm border-b border-gray-100">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-18 lg:h-20">
                        {/* Logo Section */}
                        <div className="flex flex-1 items-center space-x-2 min-w-0 pr-2">
                            <Link to="/customer/services" className="flex items-center space-x-2 min-w-0">
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

                        {/* Search Bar - Desktop/Tablet */}
                        <div className="hidden md:block flex-1 max-w-md mx-6">
                            <SearchBar />
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
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

                            {/* Logout button next to bell icon on mobile */}
                            <button
                                onClick={handleLogout}
                                className="block md:hidden p-1.5 rounded-lg hover:bg-gray-50 text-red-600 transition-all duration-200 focus:outline-none"
                                title="Sign Out"
                            >
                                <FiLogOut className="h-5 w-5" />
                            </button>

                            {/* Profile Dropdown - Unified for all screens */}
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
                                        <div className="py-2 hidden md:block">
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
                                        <div className="border-t border-gray-100 md:border-t pt-2">
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
                {/* Mobile Search Bar */}
                <div className="block md:hidden sticky top-16 z-40 px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
                    <SearchBar />
                </div>
                <div className="w-full pt-1 pb-4 lg:pt-2 lg:pb-6">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">
                {navigationItems.slice(0, 4).map((item) => {
                    const active = isActiveRoute(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <div className={`p-1 rounded-lg transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] mt-0.5 font-semibold transition-all ${active ? 'font-bold' : ''}`}>
                                {item.name.split(' ')[0]}
                            </span>
                        </Link>
                    );
                })}

                {/* Menu Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 ${mobileMenuOpen ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <div className={`p-1 rounded-lg transition-transform duration-200 ${mobileMenuOpen ? 'scale-110' : ''}`}>
                        <FiMenu className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] mt-0.5 font-semibold">
                        Menu
                    </span>
                </button>
            </nav>

            {/* Mobile Menu Popup */}
            {mobileMenuOpen && (
                <>
                    <div className="md:hidden fixed bottom-20 right-4 z-50 w-48 bg-white rounded-xl shadow-xl border border-gray-150 py-2 animate-in slide-in-from-bottom-2 duration-200">
                        {navigationItems.slice(4).map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className="flex items-center px-4 py-3 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-all duration-200"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {React.cloneElement(item.icon, { className: "mr-3 h-4 w-4" })}
                                {item.name}
                            </Link>
                        ))}
                    </div>
                    {/* Backdrop to close mobile menu */}
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                </>
            )}

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
