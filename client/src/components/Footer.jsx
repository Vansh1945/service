import React from 'react';
import { motion } from 'framer-motion';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaMapMarkerAlt, FaPhone, FaEnvelope } from 'react-icons/fa';
import Logo from './Logo'; // Assuming you have a Logo component

const Footer = () => {
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const listItemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.footer
      className="bg-blue-900 text-white pt-16 pb-8"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={sectionVariants}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <motion.div className="space-y-6" variants={sectionVariants}>
            <div className="flex items-center">
              <Logo withIcon={true} size="text-2xl" />
            </div>
            <p className="text-blue-100 leading-relaxed">
              Providing reliable electrical solutions with certified expertise and cutting-edge technology for homes and businesses.
            </p>
            <div className="flex space-x-4">
              {[FaFacebook, FaTwitter, FaInstagram, FaLinkedin].map((Icon, index) => (
                <motion.a
                  key={index}
                  href="#"
                  className="w-10 h-10 bg-blue-800 hover:bg-yellow-500 rounded-full flex items-center justify-center transition-colors duration-300"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="text-white text-lg" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={sectionVariants}>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {['Home', 'Services', 'About Us', 'Careers'].map((item, index) => (
                <motion.li key={index} variants={listItemVariants}>
                  <a 
                    href="#" 
                    className="text-blue-100 hover:text-yellow-400 transition-colors flex items-center"
                  >
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
                    {item}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Services */}
          <motion.div variants={sectionVariants}>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Our Services</h3>
            <ul className="space-y-3">
              {['Electrical Wiring', 'Lighting Solutions', 'Safety Inspections', 'Emergency Repairs'].map((item, index) => (
                <motion.li key={index} variants={listItemVariants}>
                  <a 
                    href="#" 
                    className="text-blue-100 hover:text-yellow-400 transition-colors flex items-center"
                  >
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
                    {item}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={sectionVariants}>
            <h3 className="text-lg font-bold text-yellow-400 mb-6">Contact Us</h3>
            <ul className="space-y-4 text-blue-100">
              <motion.li variants={listItemVariants} className="flex items-start">
                <FaMapMarkerAlt className="text-yellow-400 mt-1 mr-3 flex-shrink-0" />
                <span>123 Electric Ave, Power City, PC 12345</span>
              </motion.li>
              <motion.li variants={listItemVariants} className="flex items-center">
                <FaPhone className="text-yellow-400 mr-3" />
                <span>+1 (555) 123-4567</span>
              </motion.li>
              <motion.li variants={listItemVariants} className="flex items-center">
                <FaEnvelope className="text-yellow-400 mr-3" />
                <span>contact@rajelectrical.com</span>
              </motion.li>
            </ul>
          </motion.div>
        </div>

        {/* Divider */}
        <motion.hr 
          className="border-blue-800 my-12" 
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        />

        {/* Copyright */}
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-center text-blue-200 text-sm"
          variants={sectionVariants}
        >
          <p>© {new Date().getFullYear()} Raj Electrical. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-yellow-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-yellow-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-yellow-400 transition-colors">Sitemap</a>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;