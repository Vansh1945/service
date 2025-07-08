import React, { useState } from 'react';
import { 
  FaUserPlus, 
  FaSignInAlt, 
  FaTimes, 
  FaBars
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Navigation links data with icons
  const navLinks = [
    { text: "Home", path: "/"},
    { text: "About", path: "/about" },
    { text: "Services", path: "/services" },
    { text: "Careers", path: "/careers" },
    { text: "Contact", path: "/contact" }
  ];

  return (
    <nav className="bg-blue-900 text-white shadow-xl border-b-4 border-yellow-400 fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Left side - Logo & Desktop Nav */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/">
                <Logo />
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block ml-10">
              <div className="flex space-x-1">
                {navLinks.map((link) => (
                  <NavItem key={link.text} {...link} />
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Auth Buttons (Desktop) */}
          <div className="hidden md:flex items-center space-x-3">
            <ActionButton 
              icon={<FaUserPlus className="mr-2" />} 
              text="Register" 
              bgClass="bg-yellow-500 hover:bg-yellow-400" 
              textClass="text-blue-900 font-semibold"
              path="/register"
            />
            <ActionButton 
              icon={<FaSignInAlt className="mr-2" />} 
              text="Become Provider" 
              bgClass="bg-blue-800 hover:bg-blue-700" 
              textClass="text-white"
              borderClass="border border-blue-700"
              path="/provider-register"
            />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-yellow-300 hover:bg-blue-800 focus:outline-none transition duration-300"
              aria-label="Toggle menu"
            >
              {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'} bg-blue-900 transition-all duration-300`}>
        <div className="px-2 pt-2 pb-4 sm:px-3">
          <div className="flex items-center flex-col space-y-1">
            {navLinks.map((link) => (
              <MobileNavItem key={link.text} {...link} onClick={() => setIsOpen(false)} />
            ))}
          </div>
          
          <div className="pt-2 border-t border-blue-700 mt-2 space-y-2">
            <ActionButton 
              icon={<FaUserPlus className="mr-2" />} 
              text="Register" 
              bgClass="bg-yellow-500 hover:bg-yellow-400" 
              textClass="text-blue-900 font-semibold"
              fullWidth
              path="/register"
              onClick={() => setIsOpen(false)}
            />
            <ActionButton 
              icon={<FaSignInAlt className="mr-2" />} 
              text="Become Provider" 
              bgClass="bg-blue-800 hover:bg-blue-700" 
              textClass="text-white"
              borderClass="border border-blue-700"
              fullWidth
              path="/provider-register"
              onClick={() => setIsOpen(false)}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

// Reusable Components
const NavItem = ({ text, path, icon }) => (
  <Link
    to={path}
    className="px-4 py-3 rounded-md text-sm font-medium hover:bg-blue-800 hover:text-white transition duration-300 flex items-center"
  >
    {icon}
    {text}
  </Link>
);

const MobileNavItem = ({ text, path, icon, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className="px-3 py-3 rounded-md text-base font-medium hover:bg-blue-800 hover:text-white transition duration-300 flex items-center"
  >
    {icon}
    {text}
  </Link>
);

const ActionButton = ({ icon, text, bgClass, textClass, borderClass = '', fullWidth = false, path, onClick }) => (
  <Link
    to={path}
    onClick={onClick}
    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center transition duration-300 ${bgClass} ${textClass} ${borderClass} ${fullWidth ? 'w-full' : ''}`}
  >
    {icon}
    {text}
  </Link>
);

export default Navbar;