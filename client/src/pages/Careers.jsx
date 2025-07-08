import React from 'react';
import { motion } from 'framer-motion';
import { FaUserCheck, FaClipboardCheck, FaFileAlt, FaHandHoldingUsd, FaArrowRight } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CareersPage = () => {
  const steps = [
    {
      title: "Register",
      description: "Create your provider account with basic information and qualifications.",
      icon: <FaUserCheck className="text-blue-900 text-2xl" />,
      color: "from-blue-600 to-blue-900"
    },
    {
      title: "Approval",
      description: "Our team reviews your application (typically within 2 business days).",
      icon: <FaClipboardCheck className="text-blue-900 text-2xl" />,
      color: "from-indigo-900 to-blue-900"
    },
    {
      title: "Take Test",
      description: "Complete our skills assessment to verify your expertise.",
      icon: <FaFileAlt className="text-blue-900 text-2xl" />,
      color: "from-blue-900 to-indigo-900"
    },
    {
      title: "Start Earning",
      description: "Get matched with clients and begin accepting service requests.",
      icon: <FaHandHoldingUsd className="text-blue-900 text-2xl" />,
      color: "from-blue-600 to-indigo-900"
    }
  ];

  return (
    <div className="bg-blue-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[80px]"></div>
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-yellow-500 rounded-full filter blur-[90px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Become a <span className="text-yellow-400">Service Provider</span>
            </h1>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              Join our network of certified professionals and grow your business with us
            </p>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-10"
            >
              <Link 
                to="/register?role=provider"
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
              >
                Apply Now <FaArrowRight className="ml-2" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Start your journey as a service provider in just 4 simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-lg overflow-hidden border border-blue-100 transition-all duration-300 hover:shadow-xl"
            >
              <div className={`h-2 bg-gradient-to-r ${step.color}`}></div>
              <div className="p-6">
                <div className="bg-yellow-400/20 text-blue-900 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4 mx-auto">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-blue-900 mb-2 text-center">
                  Step {index + 1}: {step.title}
                </h3>
                <p className="text-gray-600 text-center">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Join Our Network?
            </h2>
            <p className="text-blue-200 max-w-2xl mx-auto">
              Benefits designed to help you succeed as a service provider
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -10 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-700"
            >
              <div className="bg-yellow-400/20 text-yellow-400 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Competitive Earnings</h3>
              <p className="text-blue-200">
                Keep up to 85% of every service fee with transparent pricing
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -10 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-700"
            >
              <div className="bg-yellow-400/20 text-yellow-400 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Verified Clients</h3>
              <p className="text-blue-200">
                Work with pre-screened clients who value professional services
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -10 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-700"
            >
              <div className="bg-yellow-400/20 text-yellow-400 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Flexible Schedule</h3>
              <p className="text-blue-200">
                Choose when and how much you want to work with no minimums
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center bg-white rounded-xl shadow-lg py-12 border border-blue-200">
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-900 mb-6">
            Ready to Start Your Journey?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join hundreds of professionals who are growing their businesses with our platform
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link 
              to="/register?role=provider"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
            >
              Apply Now <FaArrowRight className="ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default CareersPage;