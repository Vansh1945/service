import React from "react";
import { FaBolt, FaArrowRight, FaTools, FaCheck } from "react-icons/fa";
import { motion } from "framer-motion";

const HeroSection = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-900 to-indigo-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[100px] opacity-10"
        ></motion.div>
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 5,
          }}
          className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-500 rounded-full filter blur-[120px] opacity-10"
        ></motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-12">
          {/* Left Side (Text + CTA) */}
          <div className="md:w-1/2 space-y-6 text-center md:text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            >
              <span className="text-white">Powering Your</span>{" "}
              <span className="text-yellow-400 bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                Home & Business
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-blue-200 max-w-lg"
            >
              Certified electricians providing fast, reliable, and affordable electrical solutions. 
              <span className="block mt-2 text-yellow-300 font-medium">24/7 emergency services available.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl"
              >
                <FaBolt className="mr-2" /> Book a Service <FaArrowRight className="ml-2" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-transparent hover:bg-blue-800/50 text-white font-bold py-3 px-6 border-2 border-yellow-400 rounded-lg transition-all duration-300 flex items-center justify-center hover:shadow-lg backdrop-blur-sm"
              >
                <FaTools className="mr-2" /> Become a Provider
              </motion.button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-wrap justify-center md:justify-start gap-3 mt-6"
            >
              {[
                "24/7 Emergency Service",
                "Certified Electricians",
            
              ].map((text, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -2 }}
                  className="flex items-center bg-blue-800/40 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-700"
                >
                  <FaCheck className="text-yellow-400 mr-2 text-sm" />
                  <span className="text-sm text-white">{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Side (Image/Illustration) */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="md:w-1/2 flex justify-center"
          >
            <div className="relative">
              <motion.img
                whileHover={{ scale: 1.02 }}
                src="https://images.unsplash.com/photo-1605152276897-4f618f831968?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
                alt="Electrician at work"
                className="rounded-xl shadow-2xl border-4 border-yellow-400/50 hover:border-yellow-400 transition-all duration-500 w-full max-w-md"
              />
              {/* Floating Badge */}
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-4 -right-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 font-bold px-4 py-2 rounded-lg shadow-lg"
              >
                <span className="flex items-center">
                  <FaBolt className="mr-2" /> 100% Satisfaction
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Animated Lightning Bolt Decoration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.05, scale: 1 }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          repeatType: "mirror",
          ease: "easeInOut"
        }}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-yellow-400 text-[200px] pointer-events-none"
      >
        <FaBolt />
      </motion.div>

      {/* Subtle Circuit Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg 
          width="100%" 
          height="100%" 
          className="text-blue-800" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <pattern 
            id="circuit" 
            x="0" 
            y="0" 
            width="40" 
            height="40" 
            patternUnits="userSpaceOnUse"
          >
            <circle cx="20" cy="20" r="1" fill="currentColor"/>
            <path d="M0 20h40M20 0v40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1,3"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#circuit)"/>
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;