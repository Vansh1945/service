import React from 'react';
import HeroSection from '../components/HeroSection';
import WhyChooseUs from '../components/WhyChooseus';
import { motion } from 'framer-motion';
import Services from './Services';

const Home = () => {
  return (
    <div className="overflow-hidden bg-gray-50">

      {/* Hero Section */}
      <HeroSection />


      {/* Limited Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Featured Services</h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <Services limit={8} />
        </motion.div>
      </section>

      {/* Why Choose Us */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 mb-20">
        <WhyChooseUs />
      </section>
    </div>
  );
};

export default Home;
