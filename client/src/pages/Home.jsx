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
          <Services/>

     
    </div>
  );
};

export default Home;
