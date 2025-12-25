import React from 'react';
import HeroSection from '../components/HeroSection';
import WhyChooseUs from '../components/WhyChooseus';
import { motion } from 'framer-motion';
import Services from './Services';

const Home = () => {
  return (
    <div className="overflow-hidden bg-transparent">

      {/* Hero Section */}
      <HeroSection />


      {/* Limited Services Section */}
      <section className="max-w-10xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 bg-transparent">
          <Services/>
      </section>

     
    </div>
  );
};

export default Home;
