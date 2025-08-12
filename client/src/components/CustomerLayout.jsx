import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    FiMenu, FiX, FiHome, FiCalendar, FiCreditCard, 
    FiFileText, FiMessageSquare, FiBell, FiUser,
    FiAlertCircle, FiChevronDown, FiLogOut, FiShoppingCart
} from 'react-icons/fi';
import { useAuth } from '../store/auth';
import Logo from './Logo'; // Import your logo component

const CustomerLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logoutUser } = useAuth();

    const menuItems = [
        { name: 'Dashboard', path: '/customer/dashboard', icon: <FiHome /> },
        { name: 'Book Service', path: '/customer/services', icon: <FiShoppingCart /> },
        { name: 'My Bookings', path: '/customer/bookings', icon: <FiCalendar /> },
        // { name: 'Payments', path: '/customer/payments', icon: <FiCreditCard /> },
        { name: 'Invoices', path: '/customer/invoices', icon: <FiFileText /> },
        { name: 'Feedback', path: '/customer/feedback', icon: <FiMessageSquare /> },
        { name: 'Complaints', path: '/customer/complaints', icon: <FiAlertCircle /> },
    ];

    const isDashboardActive = location.pathname === '/customer' || location.pathname === '/customer/home';

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

    return (
        <div className="flex h-screen bg-blue-50 overflow-hidden">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
                </div>
            )}

            {/* Mobile sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-72 max-w-xs bg-blue-900 transform transition-transform duration-300 ease-in-out lg:hidden ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-4 py-5 border-b border-indigo-900">
                        <div className="flex items-center">
                            <Logo className="h-8 w-auto" />
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="text-blue-200 hover:text-white transition-colors"
                        >
                            <FiX size={24} />
                        </button>
                    </div>
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                                    location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive)
                                        ? 'bg-blue-600 text-white'
                                        : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                                }`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <span className="mr-3">{item.icon}</span>
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <div className="flex flex-col w-64 border-r border-gray-200 bg-blue-900">
                    <div className="flex items-center justify-center px-4 py-5 border-b border-indigo-900">
                        <Logo className="h-8 w-auto" />
                    </div>
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                                    location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive)
                                        ? 'bg-blue-600 text-white'
                                        : 'text-blue-200 hover:bg-blue-700 hover:text-white'
                                }`}
                            >
                                <span className="mr-3">{item.icon}</span>
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm lg:px-6">
                    {/* Left side - Mobile menu button and navigation links */}
                    <div className="flex items-center space-x-4">
                        <button
                            type="button"
                            className="p-2 text-gray-600 rounded-md lg:hidden hover:bg-blue-100 hover:text-blue-600 transition-colors"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <FiMenu size={20} />
                        </button>
                        
                        {/* Navigation links - visible in both desktop and mobile */}
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <Link to="/" className="text-gray-600 hover:text-blue-600 font-medium text-sm sm:text-base transition-colors">
                                Home
                            </Link>
                            <Link to="/about" className="text-gray-600 hover:text-blue-600 font-medium text-sm sm:text-base transition-colors">
                                About
                            </Link>
                            <Link to="/services" className="text-gray-600 hover:text-blue-600 font-medium text-sm sm:text-base transition-colors">
                                Services
                            </Link>
                        </div>
                    </div>

                    {/* Right side - Messages, notifications and profile */}
                    <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">
                        {/* Messages */}
                        <Link 
                            to="/customer/messages" 
                            className="p-1.5 sm:p-2 text-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 relative transition-colors"
                        >
                            <span className="sr-only">Messages</span>
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full"></div>
                            <FiMessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Link>

                        {/* Notifications */}
                        <Link 
                            to="/customer/notifications" 
                            className="p-1.5 sm:p-2 text-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 relative transition-colors"
                        >
                            <span className="sr-only">Notifications</span>
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full"></div>
                            <FiBell className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Link>

                        {/* Profile dropdown */}
                        <div className="relative">
                            <button
                                className="flex items-center space-x-1 sm:space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 transition-colors"
                                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                            >
                                {user?.profilePicUrl ? (
                                    <img 
                                        src={user.profilePicUrl} 
                                        alt="Profile" 
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                                        {getUserInitials()}
                                    </div>
                                )}
                                <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-24 md:max-w-none truncate">
                                    {user?.name || 'Customer'}
                                </span>
                                <FiChevronDown className={`text-gray-600 transition-transform w-3 h-3 sm:w-4 sm:h-4 ${
                                    profileDropdownOpen ? 'transform rotate-180' : ''
                                }`} />
                            </button>

                            {profileDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                                    <Link
                                        to="/customer/profile"
                                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center transition-colors"
                                        onClick={() => setProfileDropdownOpen(false)}
                                    >
                                        <FiUser className="mr-2" /> Profile
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center transition-colors"
                                    >
                                        <FiLogOut className="mr-2" /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main >
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default CustomerLayout;