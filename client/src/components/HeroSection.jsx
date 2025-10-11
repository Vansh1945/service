import React from "react";
import { FaBolt, FaPhone, FaClock, FaCertificate, FaChevronDown } from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import { Link } from 'react-router-dom';
import ServiceImg from '../assets/ServiceImg.png';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${ServiceImg})`
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/80"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <header className="space-y-6 md:space-y-8">
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold leading-tight text-white font-poppins animate-fadeInDown" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
            <span className="block">Power Your Home &</span>
            <span className="block text-primary">Business with Reliable</span>
            <span className="block text-accent">Electrical Services</span>
          </h1>

          {/* Subheading */}
          <p className="text-md sm:text-lg md:text-xl text-gray-200 max-w-4xl mx-auto leading-relaxed px-4 font-poppins animate-fadeInUp">
            Expert wiring, repair, and maintenance for homes & industries in Himachal & Punjab.
          </p>


          {/* Trust Indicators */}
          <div className="mt-12 md:mt-16 flex flex-wrap justify-center gap-6 md:gap-10 text-white/90 font-poppins">
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
              <FaBolt className="text-accent text-base md:text-lg" />
              <span className="text-base md:text-lg font-semibold">24/7 Emergency Service</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
              <FaBolt className="text-accent text-base md:text-lg" />
              <span className="text-base md:text-lg font-semibold">Certified Electricians</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
              <FaBolt className="text-accent text-base md:text-lg" />
              <span className="text-base md:text-lg font-semibold">Licensed & Insured</span>
            </div>
          </div>
        </header>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
