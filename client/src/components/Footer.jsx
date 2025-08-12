import React from 'react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import Logo from './Logo'; // Assuming you have a Logo component

const Footer = () => {

  return (
    <footer
      className="bg-blue-900 text-white pt-16 pb-8"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <div className="flex items-center">
              <Logo withIcon={true} size="text-2xl" />
            </div>
            <p className="text-blue-100 leading-relaxed">
              Providing reliable electrical solutions with certified expertise and cutting-edge technology for homes and businesses.
            </p>
            <div className="flex space-x-4">
              {[FaFacebook, FaTwitter, FaInstagram, FaLinkedin].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="w-10 h-10 bg-blue-800 hover:bg-yellow-500 rounded-full flex items-center justify-center transition-colors duration-300"
                >
                  <Icon className="text-white text-lg" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {['Home', 'Services', 'About Us', 'Careers'].map((item, index) => (
                <li key={index}>
                  <a 
                    href="#" 
                    className="text-blue-100 hover:text-yellow-400 transition-colors flex items-center"
                  >
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Our Services</h3>
            <ul className="space-y-3">
              {['Electrical Wiring', 'Lighting Solutions', 'Safety Inspections', 'Emergency Repairs'].map((item, index) => (
                <li key={index}>
                  <a 
                    href="#" 
                    className="text-blue-100 hover:text-yellow-400 transition-colors flex items-center"
                  >
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Contact Us</h3>
            <ul className="space-y-4 text-blue-100">
              <li className="flex items-start">
                <FaMapMarkerAlt className="text-yellow-400 mt-1 mr-3 flex-shrink-0" />
                <span>123 Electric Ave, Power City, PC 12345</span>
              </li>
              <li className="flex items-center">
                <FaPhone className="text-yellow-400 mr-3" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center">
                <FaEnvelope className="text-yellow-400 mr-3" />
                <span>contact@rajelectrical.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <hr 
          className="border-blue-800 my-12" 
        />

        {/* Copyright */}
        <div 
          className="flex flex-col md:flex-row justify-between items-center text-blue-200 text-sm"
        >
          <p>© {new Date().getFullYear()} Raj Electrical. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-yellow-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-yellow-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-yellow-400 transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;