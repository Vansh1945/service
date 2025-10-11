import React from 'react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import Logo from './Logo';

const Footer = () => {
  // Dynamic data
  const footerData = {
    company: {
      name: "SafeVolt Solutions",
      description: "Providing reliable electrical solutions with certified expertise and cutting-edge technology for homes and businesses.",
      socialLinks: [
        { Icon: FaFacebook, href: "#", label: "Facebook" },
        { Icon: FaTwitter, href: "#", label: "Twitter" },
        { Icon: FaInstagram, href: "#", label: "Instagram" },
        { Icon: FaLinkedin, href: "#", label: "LinkedIn" }
      ]
    },
    quickLinks: [
      { name: 'Home', href: '/' },
      { name: 'Services', href: '/services' },
      { name: 'About Us', href: '/about' },
      { name: 'Careers', href: '/careers' }
    ],
    services: [
      { name: 'Electrical Wiring', href: '/services' },
      { name: 'Lighting Solutions', href: '/services' },
      { name: 'Safety Inspections', href: '/services' },
      { name: 'Emergency Repairs', href: '/services' }
    ],
    contact: {
      address: "Urban Phase 1 , Jalandhar, Punjab, India 144005",
      phone: "+91 9625333919",
      email: "rajelectricalservice25@gmail.com"
    },
    legalLinks: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Sitemap', href: '/sitemap' }
    ]
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-secondary text-white pt-12 pb-6 sm:pt-16 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-1">
            <div className="flex items-center">
              <Logo withIcon={true} size="text-xl sm:text-2xl" isDark={true} />
            </div>
            <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
              {footerData.company.description}
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              {footerData.company.socialLinks.map(({ Icon, href, label }, index) => (
                <a
                  key={index}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-primary hover:bg-accent rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:shadow-lg"
                >
                  <Icon className="text-white text-base sm:text-lg" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-accent mb-4 sm:mb-6">Quick Links</h3>
            <ul className="space-y-2 sm:space-y-3">
              {footerData.quickLinks.map((item, index) => (
                <li key={index}>
                  <a 
                    href={item.href} 
                    className="text-gray-300 hover:text-accent transition-colors duration-300 flex items-center group text-sm sm:text-base"
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent rounded-full mr-2 sm:mr-3 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></span>
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-accent mb-4 sm:mb-6">Our Services</h3>
            <ul className="space-y-2 sm:space-y-3">
              {footerData.services.map((item, index) => (
                <li key={index}>
                  <a 
                    href={item.href} 
                    className="text-gray-300 hover:text-accent transition-colors duration-300 flex items-center group text-sm sm:text-base"
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent rounded-full mr-2 sm:mr-3 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></span>
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-accent mb-4 sm:mb-6">Contact Us</h3>
            <ul className="space-y-3 sm:space-y-4 text-gray-300">
              <li className="flex items-start group">
                <FaMapMarkerAlt className="text-accent mt-1 mr-2 sm:mr-3 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-sm sm:text-base leading-relaxed">{footerData.contact.address}</span>
              </li>
              <li className="flex items-center group">
                <FaPhone className="text-accent mr-2 sm:mr-3 group-hover:scale-110 transition-transform duration-300" />
                <a href={`tel:${footerData.contact.phone}`} className="text-sm sm:text-base hover:text-accent transition-colors duration-300">
                  {footerData.contact.phone}
                </a>
              </li>
              <li className="flex items-center group">
                <FaEnvelope className="text-accent mr-2 sm:mr-3 group-hover:scale-110 transition-transform duration-300" />
                <a href={`mailto:${footerData.contact.email}`} className="text-sm sm:text-base hover:text-accent transition-colors duration-300 break-all">
                  {footerData.contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-background/30 my-8 sm:my-12" />

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-gray-400 text-xs sm:text-sm space-y-4 sm:space-y-0">
          <p className="text-center sm:text-left">
            © {currentYear} {footerData.company.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center sm:justify-end space-x-4 sm:space-x-6">
            {footerData.legalLinks.map((link, index) => (
              <a 
                key={index}
                href={link.href} 
                className="hover:text-accent transition-colors duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;