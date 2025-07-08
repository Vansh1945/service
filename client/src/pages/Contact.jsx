import React from 'react';
import { motion } from 'framer-motion';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaClock, FaHeadset } from 'react-icons/fa';

const ContactPage = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your form submission logic here
    alert('Message sent successfully!');
  };

  return (
    <div className="bg-blue-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-yellow-500 rounded-full filter blur-[120px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Get In <span className="text-yellow-400">Touch</span>
            </h1>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              We're here to help and answer any questions you might have
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form and Info Section */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Contact Information - Now on Left Side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            {/* Contact Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 p-8">
              <h2 className="text-3xl font-bold text-blue-900 mb-8">Our Contact Details</h2>
              
              <div className="space-y-8">
                {/* Phone */}
                <div className="flex items-start">
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-xl mr-6 shadow-md">
                    <FaPhone className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">Call Us</h3>
                    <p className="text-gray-600 text-lg">(123) 456-7890</p>
                    <p className="text-blue-600 mt-2 flex items-center">
                      <FaHeadset className="mr-2" /> 24/7 Support Available
                    </p>
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-start">
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-xl mr-6 shadow-md">
                    <FaEnvelope className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">Email Us</h3>
                    <p className="text-gray-600 text-lg">contact@yourelectric.com</p>
                    <p className="text-gray-600 text-lg">support@yourelectric.com</p>
                  </div>
                </div>
                
                {/* Address */}
                <div className="flex items-start">
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-xl mr-6 shadow-md">
                    <FaMapMarkerAlt className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">Visit Us</h3>
                    <p className="text-gray-600 text-lg">123 Electric Avenue</p>
                    <p className="text-gray-600 text-lg">Tech City, TC 12345</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Map Embed */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100">
              <iframe
                title="Company Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.215256024043!2d-73.98784468459382!3d40.74844047932799!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1629830000000!5m2!1sen!2sus"
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
              ></iframe>
            </div>
            
            {/* Business Hours */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100 p-8">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-3 rounded-lg mr-4">
                  <FaClock className="text-xl" />
                </div>
                <h3 className="text-2xl font-semibold text-blue-900">Business Hours</h3>
              </div>
              <ul className="space-y-4 text-gray-600 text-lg">
                <li className="flex justify-between pb-3 border-b border-blue-100">
                  <span className="font-medium">Monday - Friday</span>
                  <span>8:00 AM - 5:00 PM</span>
                </li>
                <li className="flex justify-between pb-3 border-b border-blue-100">
                  <span className="font-medium">Saturday</span>
                  <span>9:00 AM - 2:00 PM</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-medium">Sunday</span>
                  <span>Closed</span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Contact Form - Now on Right Side */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-blue-100"
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-900 text-white py-6 px-8">
              <h2 className="text-3xl font-bold">Send Us a Message</h2>
              <p className="text-blue-200 mt-2">We typically respond within 24 hours</p>
            </div>
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-gray-700 text-lg font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-5 py-4 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-300 text-lg"
                    placeholder="Your name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-gray-700 text-lg font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-5 py-4 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-300 text-lg"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-gray-700 text-lg font-medium mb-2">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    className="w-full px-5 py-4 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-300 text-lg"
                    placeholder="(123) 456-7890"
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-gray-700 text-lg font-medium mb-2">Your Message</label>
                  <textarea
                    id="message"
                    rows="6"
                    className="w-full px-5 py-4 rounded-xl border-2 border-blue-100 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-300 text-lg"
                    placeholder="How can we help you?"
                    required
                  ></textarea>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-lg"
                >
                  <FaPaperPlane className="mr-3" /> Send Message
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;