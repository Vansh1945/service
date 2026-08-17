import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiMenu, FiX, FiHome, FiCheckCircle, FiUsers, FiCalendar,
  FiDollarSign, FiTag, FiAlertCircle, FiChevronDown,
  FiLogOut, FiUser, FiSettings, FiCreditCard, FiActivity,
  FiMessageSquare, FiHelpCircle, FiLayers, FiLayout, FiPhoneCall, FiShield, FiTerminal,
  FiMapPin, FiMail, FiSend, FiClock, FiAward, FiFileText, FiSliders
} from 'react-icons/fi';
import { useAuth } from '../context/auth';
import { useAdminFilter } from '../context/AdminFilterContext';
import NotificationBell from '../components/NotificationBell';
import AdminSearchBar from '../components/AdminSearchBar';
import AdminFilterBar, { getRouteFilterConfig } from '../components/AdminFilterBar';
import FinanceInvestigationDrawer from '../components/FinanceInvestigationDrawer';



const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logoutUser, systemSettings: authSystemSettings = {}, activeBranding = {} } = useAuth();
  const { showGlobalFilterBar, setShowGlobalFilterBar } = useAdminFilter();
  const hasFilterConfig = !!getRouteFilterConfig(location.pathname);

  const logo = activeBranding?.logo || authSystemSettings?.logo || null;
  const companyName = authSystemSettings?.companyName || 'Raj Electrical Services';
  const appName = activeBranding?.appName || 'Admin Panel';

  const [collapsedGroups, setCollapsedGroups] = useState({
    dashboard: false,
    users: false,
    bookings: false,
    financials: false,
    support: false,
    notifications: false,
    system: false,
    setup: false,
  });

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const menuGroups = [
    {
      id: 'dashboard',
      title: 'Dashboard & Analytics',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: <FiHome className="w-5 h-5" /> },
        { name: 'Live Map Dashboard', path: '/admin/live-map', icon: <FiMapPin className="w-5 h-5" /> },
      ]
    },
    {
      id: 'users',
      title: 'User Management',
      items: [
        { name: 'Approved Providers', path: '/admin/approve-providers', icon: <FiCheckCircle className="w-5 h-5" /> },
        { name: 'Pending Providers', path: '/admin/providers', icon: <FiUsers className="w-5 h-5" /> },
        { name: 'All Customers', path: '/admin/customers', icon: <FiUser className="w-5 h-5" /> },
      ]
    },
    {
      id: 'bookings',
      title: 'Bookings & Zones',
      items: [
        { name: 'Bookings', path: '/admin/bookings', icon: <FiCalendar className="w-5 h-5" /> },
        { name: 'Add Services', path: '/admin/add-services', icon: <FiLayers className="w-5 h-5" /> },
        { name: 'Category & Banner', path: '/admin/category-banner', icon: <FiLayout className="w-5 h-5" /> },
        { name: 'Zone Management', path: '/admin/zone-management', icon: <FiLayers className="w-5 h-5" /> },
      ]
    },
    {
      id: 'financials',
      title: 'Financials & Operations',
      items: [
        { name: 'Finance Dashboard', path: '/admin/finance-dashboard', icon: <FiHome className="w-5 h-5" /> },
        { name: 'Payment Management', path: '/admin/payments', icon: <FiCreditCard className="w-5 h-5" /> },
        { name: 'Transactions Ledger', path: '/admin/transactions', icon: <FiActivity className="w-5 h-5" /> },
        { name: 'Refund Management', path: '/admin/refunds', icon: <FiDollarSign className="w-5 h-5" /> },
        { name: 'Cash Payments', path: '/admin/cash-payments', icon: <FiDollarSign className="w-5 h-5" /> },
        { name: 'Customer Wallets', path: '/admin/customer-wallets', icon: <FiUser className="w-5 h-5" /> },
        { name: 'Provider Wallets', path: '/admin/provider-wallets', icon: <FiUsers className="w-5 h-5" /> },
        { name: 'Provider Earnings', path: '/admin/provider-earnings', icon: <FiActivity className="w-5 h-5" /> },
        { name: 'Withdrawals / Payout', path: '/admin/payout', icon: <FiCreditCard className="w-5 h-5" /> },
        { name: 'Settlements', path: '/admin/settlements', icon: <FiLayers className="w-5 h-5" /> },
        { name: 'Commission Settings', path: '/admin/commission', icon: <FiDollarSign className="w-5 h-5" /> },
        { name: 'Razorpay Management', path: '/admin/razorpay', icon: <FiTerminal className="w-5 h-5" /> },
        { name: 'Failed Payments', path: '/admin/failed-payments', icon: <FiAlertCircle className="w-5 h-5" /> },
        { name: 'Financial Reports', path: '/admin/earning-reports', icon: <FiFileText className="w-5 h-5" /> },
        { name: 'Audit Logs', path: '/admin/audit-logs', icon: <FiShield className="w-5 h-5" /> },
        { name: 'Coupons', path: '/admin/coupons', icon: <FiTag className="w-5 h-5" /> },
        { name: 'Surge Surcharges', path: '/admin/surge', icon: <FiAlertCircle className="w-5 h-5" /> },
        { name: 'Referrals & Rewards', path: '/admin/referrals', icon: <FiAward className="w-5 h-5" /> },
      ]
    },
    {
      id: 'support',
      title: 'Support & Interaction',
      items: [
        { name: 'Complaint', path: '/admin/complaints', icon: <FiAlertCircle className="w-5 h-5" /> },
        { name: 'Feedback', path: '/admin/feedback', icon: <FiMessageSquare className="w-5 h-5" /> },
        { name: 'User Contacts', path: '/admin/user-contacts', icon: <FiPhoneCall className="w-5 h-5" /> },
        { name: 'Chat Monitor', path: '/admin/chat-monitor', icon: <FiMessageSquare className="w-5 h-5" /> },
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      items: [
        { name: 'Compose Notification', path: '/admin/compose-notification', icon: <FiSend className="w-5 h-5" /> },
        { name: 'Rule-Based Event Templates', path: '/admin/event-templates', icon: <FiLayers className="w-5 h-5" /> },
        { name: 'Broadcast History', path: '/admin/broadcast-history', icon: <FiClock className="w-5 h-5" /> },
      ]
    },
    {
      id: 'system',
      title: 'System & Security',
      items: [
        { name: 'Fraud Detection', path: '/admin/fraud', icon: <FiShield className="w-5 h-5" /> },
        { name: 'System Logs', path: '/admin/system-logs', icon: <FiTerminal className="w-5 h-5" /> },
        { name: 'Provider Test', path: '/admin/add-questions', icon: <FiHelpCircle className="w-5 h-5" /> },
      ]
    },
    {
      id: 'setup',
      title: 'Configuration',
      items: [
        { name: 'Settings', path: '/admin/settings', icon: <FiSettings className="w-5 h-5" /> },
        { name: 'Branding Management', path: '/admin/branding', icon: <FiLayout className="w-5 h-5" /> },
        { name: 'Email Templates', path: '/admin/email-templates', icon: <FiMail className="w-5 h-5" /> },
        { name: 'PDF Templates', path: '/admin/pdf-templates', icon: <FiFileText className="w-5 h-5" /> },

      ]
    }
  ];

  const isDashboardActive = location.pathname === '/admin' || location.pathname === '/admin/dashboard';

  const handleLogout = () => {
    logoutUser();
    setProfileDropdownOpen(false);
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'A';
    const names = user.name.split(' ');
    return names.map(name => name[0]).join('').toUpperCase();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile sidebar */}
        <div className={`relative flex flex-col w-80 max-w-[calc(100vw-3rem)] h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          {/* Mobile header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center flex-1 min-w-0 pr-2">
              {logo && (
                <img
                  src={logo}
                  alt={companyName}
                  className="h-8 w-auto object-contain mr-2 flex-shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-secondary truncate leading-tight">
                  {companyName}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary truncate">
                  {appName}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 flex-shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-secondary transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="flex-1 px-4 py-4 space-y-3 overflow-y-auto min-h-0">
            {menuGroups.map((group) => {
              const isCollapsed = collapsedGroups[group.id];
              return (
                <div key={group.id} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-secondary transition-colors"
                  >
                    <span>{group.title}</span>
                    <FiChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''
                        }`}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 pl-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive);
                        return (
                          <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
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
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-72 h-full bg-white border-r border-gray-200 shadow-xs">
          {/* Desktop header */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center min-w-0">
              {logo && (
                <img
                  src={logo}
                  alt={companyName}
                  className="h-9 w-auto object-contain mr-3 flex-shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold text-secondary truncate leading-tight">
                  {companyName}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary truncate">
                  {appName}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop navigation */}
          <nav className="flex-1 px-4 py-4 space-y-3 overflow-y-auto min-h-0">
            {menuGroups.map((group) => {
              const isCollapsed = collapsedGroups[group.id];
              return (
                <div key={group.id} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-secondary transition-colors"
                  >
                    <span>{group.title}</span>
                    <FiChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''
                        }`}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 pl-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.path || (item.name === 'Dashboard' && isDashboardActive);
                        return (
                          <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center px-3.5 py-2 text-sm font-medium rounded-xl transition-all duration-200 group ${isActive
                              ? 'bg-primary text-white shadow-md shadow-primary/20 font-semibold'
                              : 'text-secondary hover:bg-primary/10 hover:text-primary'
                              }`}
                          >
                            <span className="mr-3 flex-shrink-0">{item.icon}</span>
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top navigation bar */}
        <header className="bg-white border-b border-gray-200 shadow-xs z-30 flex-shrink-0 h-16 flex items-center px-4 lg:px-6">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Left side - Mobile menu button & Search bar */}
            <div className="flex items-center flex-1 min-w-0 gap-3">
              <button
                type="button"
                className="p-2 rounded-lg text-secondary lg:hidden hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <FiMenu className="w-6 h-6" />
              </button>

              {/* Page title on mobile */}
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter lg:hidden truncate flex-shrink-0">
                {menuGroups.flatMap(g => g.items).find(item => item.path === location.pathname)?.name || 'Dashboard'}
              </h1>

              {/* Desktop Global Search Bar & Filters Button */}
              <div className="hidden lg:flex items-center flex-1 max-w-xl gap-3">
                <div className="flex-1 min-w-0">
                  <AdminSearchBar isGlobal={true} menuGroups={menuGroups} placeholder="Search customers, providers, bookings, payments..." />
                </div>
                {hasFilterConfig && (
                  <button
                    type="button"
                    onClick={() => setShowGlobalFilterBar(!showGlobalFilterBar)}
                    title={showGlobalFilterBar ? "Hide Global Filters" : "Show Global Filters"}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all flex-shrink-0 ${showGlobalFilterBar
                      ? 'bg-primary text-white border-primary shadow-xs hover:bg-teal-700'
                      : 'bg-white border-gray-250 text-gray-600 hover:bg-gray-50 hover:border-gray-350 hover:text-secondary'
                      }`}
                  >
                    <FiSliders className="w-4 h-4" />
                    <span>Global Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right side - Actions and profile */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              {/* Notifications */}
              <NotificationBell />

              {/* Profile dropdown */}
              <div className="relative">
                {profileDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setProfileDropdownOpen(false)} />
                )}
                <button
                  className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 relative z-40"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  {user?.profilePicUrl ? (
                    <img
                      src={user.profilePicUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {getUserInitials()}
                    </div>
                  )}
                  <div className="hidden md:block text-left min-w-0 max-w-[150px]">
                    <p className="text-sm font-medium text-secondary font-inter truncate leading-tight">
                      {user?.name || 'Admin'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-inter truncate leading-tight">
                      {user?.email || 'admin@example.com'}
                    </p>
                  </div>
                  <FiChevronDown
                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${profileDropdownOpen ? 'transform rotate-180' : ''
                      }`}
                  />
                </button>

                {/* Dropdown menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-40 border border-gray-200 animate-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-medium text-secondary font-inter truncate">
                        {user?.name || 'Admin'}
                      </p>
                      <p className="text-xs text-gray-500 truncate font-inter">
                        {user?.email || 'admin@example.com'}
                      </p>
                    </div>

                    <Link
                      to="/admin/profile"
                      className="flex items-center px-4 py-2.5 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <FiUser className="w-4 h-4 mr-3 text-gray-500" />
                      <span className="font-inter">Profile Settings</span>
                    </Link>

                    <Link
                      to="/admin/settings"
                      className="flex items-center px-4 py-2.5 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <FiSettings className="w-4 h-4 mr-3 text-gray-500" />
                      <span className="font-inter">Account Settings</span>
                    </Link>

                    <hr className="my-1 border-gray-100" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FiLogOut className="w-4 h-4 mr-3" />
                      <span className="font-inter">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 min-h-0 min-w-0">
          {/* Mobile Global Search Bar */}
          <div className="block lg:hidden sticky top-0 px-4 py-3 bg-white border-b border-gray-200 shadow-xs z-20">
            <AdminSearchBar isGlobal={true} menuGroups={menuGroups} placeholder="Search admin pages..." />
          </div>
          <div className="p-4 lg:p-6 xl:p-8 space-y-4">
            {/* Route-Aware Centralized Global Filter Bar */}
            <AdminFilterBar />
            <Outlet />
          </div>
        </main>
      </div>
      <FinanceInvestigationDrawer />
    </div>
  );
};


export default AdminLayout;