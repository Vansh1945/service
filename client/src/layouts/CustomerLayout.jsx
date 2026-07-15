import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiCalendar, FiMessageSquare, FiUser, FiAlertCircle, FiLogOut,
    FiShoppingBag, FiMenu, FiChevronDown, FiMapPin, FiGift,
    FiChevronRight, FiHelpCircle, FiArrowLeft, FiCreditCard
} from 'react-icons/fi';
import { FaBolt } from 'react-icons/fa';
import { useAuth } from '../context/auth';
import NotificationBell from '../components/NotificationBell';
import SearchBar from '../pages/Customer/components/Customer-SearchBar';

export const DEFAULT_COMPANY_NAME = 'Raj Electrical Services';
export const DEFAULT_CUSTOMER_APP_NAME = 'Customer App';
export const DEFAULT_PROVIDER_APP_NAME = 'Provider App';

export const getUserInitials = (user, fallback = 'U') => {
    if (!user?.name) return fallback;
    return user.name.split(' ').map(name => name[0]).join('').toUpperCase();
};

export const useClickOutside = (ref1, ref2, callback) => {
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                ref1.current && 
                !ref1.current.contains(event.target) &&
                (!ref2 || (ref2.current && !ref2.current.contains(event.target)))
            ) {
                callback();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref1, ref2, callback]);
};

export const UserAvatar = ({ user, size = "w-8 h-8", fallbackChar = 'U' }) => {
    const initials = getUserInitials(user, fallbackChar);
    return user?.profilePicUrl ? (
        <img src={user.profilePicUrl} alt="Profile" className={`${size} rounded-full object-cover border border-primary/20 shadow-sm`} />
    ) : (
        <div className={`${size} rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-sm`}>{initials}</div>
    );
};

const CustomerLayout = () => {
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser, systemSettings: authSystemSettings = {}, activeBranding = {} } = useAuth();
    
    const dropdownRef = useRef(null);
    const avatarRef = useRef(null);

    const logo = activeBranding?.logo || authSystemSettings?.logo || null;
    const companyName = authSystemSettings?.companyName || DEFAULT_COMPANY_NAME;
    const appName = activeBranding?.appName || DEFAULT_CUSTOMER_APP_NAME;

    useClickOutside(dropdownRef, avatarRef, () => setProfileDropdownOpen(false));

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
        setProfileDropdownOpen(false);
        setMobileMenuOpen(false);
    };

    const isActiveRoute = (path) => location.pathname === path;

    // Minimal and flat menu item list
    const getMenuItems = () => {
        return [
            { name: 'Profile Information', path: '/customer/profile', icon: <FiUser className="w-5 h-5" /> },
            { name: 'Bookings', path: '/customer/bookings', icon: <FiCalendar className="w-5 h-5" /> },
            { name: 'Feedback', path: '/customer/feedback', icon: <FiMessageSquare className="w-5 h-5" /> },
            { name: 'Support', path: '/customer/complaints', icon: <FiAlertCircle className="w-5 h-5" /> },
            { name: 'Refer & Earn', path: '/customer/refer-earn', icon: <FiGift className="w-5 h-5" /> }
        ];
    };

    const renderDesktopMenu = () => (
        <div className="space-y-1 text-left">
            <div className="space-y-0.5">
                {getMenuItems().map((item) => {
                    const active = isActiveRoute(item.path);
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setProfileDropdownOpen(false)}
                            className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all relative ${active ? 'bg-primary/10 text-primary' : 'text-neutral-600 hover:text-primary hover:bg-neutral-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                {React.cloneElement(item.icon, { className: 'w-4 h-4' })}
                                {item.name}
                            </span>
                            {active && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 bg-primary rounded-r" />
                            )}
                            <FiChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform duration-200" />
                        </Link>
                    );
                })}
            </div>
            <div className="pt-1.5 border-t border-neutral-100 mt-1.5">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-extrabold text-danger hover:bg-danger/10 transition-all text-left"
                >
                    <span className="flex items-center gap-2"><FiLogOut className="w-4 h-4" /> Sign Out</span>
                    <FiChevronRight className="w-4 h-4 text-neutral-400" />
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background lg:pb-0">
            {/* Desktop Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-neutral-100 shadow-sm transition-all duration-300">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Left Logo */}
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                            <Link to="/customer/services" className="flex items-center space-x-2.5 min-w-0 group">
                                {logo ? (
                                    <img src={logo} alt={companyName} className="flex-shrink-0 h-9 md:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
                                ) : (
                                    <FaBolt className="h-9 w-auto text-primary transition-transform duration-300 group-hover:rotate-12" />
                                )}
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-sm sm:text-base md:text-lg text-secondary truncate leading-tight tracking-tight">{companyName}</span>
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary truncate">{appName}</span>
                                </div>
                            </Link>
                        </div>

                        {/* Search Bar */}
                        <div className="hidden md:block flex-1 max-w-md mx-6">
                            <SearchBar />
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                            {/* Location */}
                            <div className="hidden lg:flex items-center space-x-2 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-all duration-200 border border-neutral-100">
                                <FiMapPin className="h-5 w-5 text-accent" />
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider leading-none mb-0.5">Service Area</span>
                                    <span className="text-xs font-bold text-secondary truncate max-w-28 leading-tight">{user?.address?.city || user?.city || 'Your Location'}</span>
                                </div>
                                <FiChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                            </div>

                            <NotificationBell />

                            {/* Mobile Sign Out */}
                            <button onClick={handleLogout} className="block md:hidden p-2 rounded-xl text-danger hover:bg-danger-light/10 transition-all duration-200" title="Sign Out">
                                <FiLogOut className="h-5 w-5" />
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative hidden md:block">
                                <button
                                    ref={avatarRef}
                                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                    className="flex items-center space-x-2.5 p-1 rounded-full md:p-1.5 md:bg-neutral-50 md:hover:bg-neutral-100 transition-all duration-200 focus:outline-none border border-transparent md:border-neutral-100"
                                >
                                    <UserAvatar user={user} size="w-8 h-8" fallbackChar="C" />
                                    <span className="hidden sm:block text-sm font-semibold text-secondary max-w-20 truncate">{user?.name || 'Customer'}</span>
                                    <FiChevronDown className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {profileDropdownOpen && (
                                    <div ref={dropdownRef} className="absolute right-0 mt-2.5 w-[300px] bg-white rounded-2xl shadow-xl border border-neutral-100 p-3 z-[60] animate-in fade-in slide-in-from-top-2 duration-200 space-y-2.5">
                                        {/* User Card */}
                                        <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-100">
                                            <UserAvatar user={user} size="w-9 h-9" fallbackChar="C" />
                                            <div className="flex flex-col min-w-0 text-left">
                                                <p className="text-xs font-bold text-secondary truncate">{user?.name || 'Customer'}</p>
                                                <p className="text-[10px] text-neutral-400 truncate mt-0.5">{user?.email}</p>
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
                <div className="block md:hidden sticky top-16 z-40 px-4 py-3.5 bg-background border-b border-neutral-100 shadow-sm">
                    <SearchBar />
                </div>
                <div className="w-full pt-1 pb-4">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-100 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex justify-around items-center h-16 px-2">
                <Link to="/customer/services" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/customer/services') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMobileMenuOpen(false)}>
                    <FiShoppingBag className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Home</span>
                    {isActiveRoute('/customer/services') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                <Link to="/customer/bookings" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/customer/bookings') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMobileMenuOpen(false)}>
                    <FiCalendar className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Bookings</span>
                    {isActiveRoute('/customer/bookings') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                <Link to="/customer/feedback" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/customer/feedback') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMobileMenuOpen(false)}>
                    <FiMessageSquare className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Feedback</span>
                    {isActiveRoute('/customer/feedback') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                <Link to="/customer/complaints" className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${isActiveRoute('/customer/complaints') ? 'text-primary' : 'text-neutral-400'}`} onClick={() => setMobileMenuOpen(false)}>
                    <FiAlertCircle className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Support</span>
                    {isActiveRoute('/customer/complaints') && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </Link>

                <button onClick={() => setMobileMenuOpen(true)} className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all relative ${mobileMenuOpen ? 'text-primary' : 'text-neutral-400'}`}>
                    <FiMenu className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5 font-semibold">Menu</span>
                    {mobileMenuOpen && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
                </button>
            </nav>

            {/* Mobile Bottom Sheet (Blinkit Style - Redesigned) */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setMobileMenuOpen(false)} />
                    <div className="relative bg-white rounded-t-[24px] shadow-2xl border-t border-neutral-100 max-h-[85vh] overflow-y-auto z-10 transition-transform duration-300 transform translate-y-0 pb-6 px-4">
                        {/* Drag handle */}
                        <div className="flex items-center justify-between pt-3 pb-2.5">
                            <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500" aria-label="Close menu">
                                <FiArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-1 bg-neutral-200 rounded-full" />
                            <div className="w-7" />
                        </div>

                        {/* Premium Compact User Card */}
                        <Link to="/customer/profile" onClick={() => setMobileMenuOpen(false)} className="mb-4 p-3 rounded-xl border border-neutral-100 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                            <div className="flex items-center gap-2.5">
                                <UserAvatar user={user} size="w-9 h-9" fallbackChar="C" />
                                <div className="flex flex-col min-w-0 text-left">
                                    <p className="text-xs font-bold text-secondary truncate">{user?.name || 'Customer'}</p>
                                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">{user?.email}</p>
                                    {user?.wallet && (
                                        <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.75 bg-success/10 text-success rounded-md text-[9px] font-black tracking-wide w-fit select-none">
                                            <span>💰</span> Wallet Balance • ₹{user.wallet.availableBalance || 0} Raj Credits
                                        </div>
                                    )}
                                </div>
                            </div>
                            <FiChevronRight className="w-4 h-4 text-neutral-400" />
                        </Link>

                        {/* Flat Menu Item Rows (No Categories) */}
                        <div className="space-y-1 text-left">
                            {getMenuItems().map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="group flex items-center justify-between px-3 py-2.5 h-11 rounded-lg bg-neutral-50/50 hover:bg-neutral-50 transition-all"
                                >
                                    <span className="flex items-center gap-2.5 text-xs font-bold text-secondary">
                                        {React.cloneElement(item.icon, { className: 'w-4.5 h-4.5 text-neutral-400' })}
                                        {item.name}
                                    </span>
                                    <FiChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform duration-200" />
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
        </div>
    );
};

export default CustomerLayout;
