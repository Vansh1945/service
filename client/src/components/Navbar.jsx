import React, { useState, useEffect, useRef } from 'react';
import {
  FiUserPlus,
  FiLogIn,
  FiX,
  FiMenu,
  FiHome,
  FiInfo,
  FiSettings,
  FiBriefcase,
  FiMail
} from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ companyName: '', logo: null });
  const location = useLocation();
  const menuRef = useRef(null);
  const { API } = useAuth();

  // Handle scroll effect with smoother transition
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch system settings
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await fetch(`${API}/system-setting/system-data`);
        if (response.ok) {
          const data = await response.json();
          setSystemSettings({
            companyName: data.data?.companyName || '',
            logo: data.data?.logo || null
          });
        }
      } catch (error) {
        console.error('Failed to fetch system settings:', error);
      }
    };

    fetchSystemSettings();
  }, [API]);

  // Navigation links data with icons
  const navLinks = [
    { text: "Home", path: "/", icon: <FiHome className="mr-2 text-sm" /> },
    { text: "About", path: "/about", icon: <FiInfo className="mr-2 text-sm" /> },
    { text: "Service", path: "/services", icon: <FiSettings className="mr-2 text-sm" /> },
    { text: "Career", path: "/careers", icon: <FiBriefcase className="mr-2 text-sm" /> },
    { text: "Contact", path: "/contact", icon: <FiMail className="mr-2 text-sm" /> }
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed w-full top-0 z-50 transition-all duration-500 ease-out ${
        scrolled 
          ? 'bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-lg' 
          : 'bg-white border-b border-gray-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-18 lg:h-20 items-center">
          {/* Left side - Logo & Desktop Nav */}
          <div className="flex items-center">
              <Link
                to="/"
              className="transition-all duration-300 focus:outline-none rounded-lg p-1"
                aria-label="Go to homepage"
              >
                <div className="flex items-center">
                  {systemSettings.logo && (
                    <img
                      src={systemSettings.logo}
                      alt={systemSettings.companyName || 'SAFEVOLT SOLUTIONS'}
                      className="h-8 md:h-10 lg:h-12 w-auto object-contain mr-3"
                    />
                  )}
                  <span className="font-extrabold text-xl md:text-2xl lg:text-3xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter tracking-tight">
                    {systemSettings.companyName || 'SAFEVOLT SOLUTIONS'}
                  </span>
                </div>
              </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:block ml-8 xl:ml-12">
              <div className="flex space-x-1">
                {navLinks.map((link) => (
                  <NavItem
                    key={link.text}
                    {...link}
                    isActive={location.pathname === link.path}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Auth Buttons (Desktop) */}
          <div className="hidden lg:flex items-center space-x-3">
            <ActionButton
              icon={<FiLogIn className="mr-2 text-sm" />}
              text="Login"
              variant="secondary"
              path="/login"
            />
            <ActionButton
              icon={<FiUserPlus className="mr-2 text-sm" />}
              text="Register"
              variant="primary"
              path="/register"
            />
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-secondary hover:text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-300"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              <div className="relative w-6 h-6">
                <span className={`absolute inset-0 transition-all duration-300 ${isOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`}>
                  <FiMenu size={24} />
                </span>
                <span className={`absolute inset-0 transition-all duration-300 ${isOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`}>
                  <FiX size={24} />
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu with slide animation */}
      <div
        ref={menuRef}
        className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${
          isOpen
            ? 'max-h-screen opacity-100 visible'
            : 'max-h-0 opacity-0 invisible'
        } bg-white/98 backdrop-blur-xl border-t border-gray-200 shadow-xl`}
      >
        <div className="px-6 py-8 space-y-6">
          {/* Mobile Navigation Links */}
          <div className="space-y-2">
            {navLinks.map((link) => (
              <MobileNavItem
                key={link.text}
                {...link}
                isActive={location.pathname === link.path}
                onClick={() => setIsOpen(false)}
              />
            ))}
          </div>

          {/* Mobile Action Buttons */}
          <div className="pt-6 border-t border-gray-200/20 space-y-3">
            <ActionButton
              icon={<FiLogIn className="mr-3 text-base" />}
              text="Login"
              variant="secondary"
              fullWidth
              path="/login"
              onClick={() => setIsOpen(false)}
            />
            <ActionButton
              icon={<FiUserPlus className="mr-3 text-base" />}
              text="Register"
              variant="primary"
              fullWidth
              path="/register"
              onClick={() => setIsOpen(false)}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

// Enhanced NavItem with professional hover animations
const NavItem = ({ text, path, icon, isActive }) => (
  <Link
    to={path}
    className={`relative px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center group ${
      isActive
        ? 'text-primary bg-primary/10 shadow-sm'
        : 'text-secondary hover:text-accent'
    }`}
  >
    {/* Animated background on hover */}
    <div className={`absolute inset-0 rounded-lg transition-all duration-300 transform ${
      isActive
        ? 'bg-primary/5 scale-100 opacity-100'
        : 'bg-accent/5 scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100'
    }`} />

    {/* Animated border bottom */}
    <div className={`absolute bottom-0 left-1/2 w-0 h-0.5 transition-all duration-300 transform -translate-x-1/2 ${
      isActive
        ? 'bg-primary w-4/5'
        : 'bg-accent group-hover:w-3/5'
    }`} />

    <span className="relative z-10 flex items-center">
      {icon}
      {text}
    </span>
  </Link>
);

// Enhanced MobileNavItem
const MobileNavItem = ({ text, path, icon, isActive, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`relative flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
      isActive
        ? 'text-primary bg-primary/10 border-r-2 border-primary'
        : 'text-secondary hover:text-accent hover:bg-accent/5'
    }`}
  >
    {/* Subtle hover effect */}
    <div className={`absolute inset-0 rounded-lg transition-all duration-300 transform ${
      isActive
        ? 'bg-primary/5 scale-100 opacity-100'
        : 'bg-accent/5 scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100'
    }`} />

    <span className="relative z-10 flex items-center">
      {icon}
      {text}
    </span>
  </Link>
);

// Enhanced ActionButton with professional animations
const ActionButton = ({ icon, text, variant = 'primary', fullWidth = false, path, onClick }) => {
  const baseClasses = "relative px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 overflow-hidden group";

  const variantClasses = {
    primary: "bg-accent text-white hover:bg-primary hover:shadow-lg focus:ring-accent/50",
    secondary: "bg-white text-secondary border border-gray-300 hover:border-primary/30 hover:shadow-md focus:ring-primary/30"
  };

  return (
    <Link
      to={path}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''}`}
    >
      {/* Hover overlay effect */}
      <div className={`absolute inset-0 transition-all duration-300 transform ${
        variant === 'primary' 
          ? 'bg-white/0 group-hover:bg-white/10' 
          : 'bg-primary/0 group-hover:bg-primary/5'
      }`} />
      
      {/* Button content */}
      <span className="relative z-10 flex items-center">
        {icon}
        {text}
      </span>
      
      {/* Subtle scale effect */}
      <div className={`absolute inset-0 rounded-lg border-2 border-transparent transition-all duration-300 transform scale-105 opacity-0 group-hover:opacity-100 ${
        variant === 'primary' ? 'border-white/20' : 'border-primary/10'
      }`} />
    </Link>
  );
};

export default Navbar;