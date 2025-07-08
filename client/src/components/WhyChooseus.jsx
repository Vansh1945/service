import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  DollarSign, 
  Shield,
  Star,
  Users,
  TrendingUp,
  CheckCircle2,
  Heart,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const WhyChooseUs = () => {
  const [visibleCards, setVisibleCards] = useState(new Set());
  const [hoveredCard, setHoveredCard] = useState(null);
  const [countUp, setCountUp] = useState({ 
    projects: 0, 
    satisfaction: 0,
    service: 0,
    experience: 0
  });
  const sectionRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Feature cards data (only 3 cards)
  const features = [
    {
      icon: Award,
      title: "Certified Experts",
      description: "All our electricians are licensed, background-checked, and trained to the highest industry standards.",
      gradient: "from-blue-600 to-blue-700",
      glowColor: "shadow-blue-600/30"
    },
    {
      icon: DollarSign,
      title: "Affordable Pricing",
      description: "No hidden charges. We offer competitive rates with transparent pricing for all services.",
      gradient: "from-yellow-400 to-yellow-500",
      glowColor: "shadow-yellow-400/30"
    },
    {
      icon: Shield,
      title: "Safety First",
      description: "We follow strict safety protocols to ensure risk-free electrical installations and repairs.",
      gradient: "from-emerald-500 to-emerald-600",
      glowColor: "shadow-emerald-500/30"
    }
  ];

  // Stats data (4 stats)
  const stats = [
    { key: 'projects', target: 500, suffix: '+', label: 'Projects Completed', icon: CheckCircle2 },
    { key: 'satisfaction', target: 99, suffix: '%', label: 'Customer Satisfaction', icon: Heart },
    { key: 'service', target: 24, suffix: '/7', label: 'Emergency Service', icon: Clock },
    { key: 'experience', target: 20, suffix: '+', label: 'Years Experience', icon: Award }
  ];

  // Intersection Observer for card animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardIndex = parseInt(entry.target.dataset.index);
            setTimeout(() => {
              setVisibleCards(prev => new Set([...prev, cardIndex]));
            }, cardIndex * 150);
          }
        });
      },
      { threshold: 0.2 }
    );

    const cards = sectionRef.current?.querySelectorAll('[data-index]');
    cards?.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  // Counter animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            stats.forEach((stat) => {
              let current = 0;
              const increment = stat.target / 100;
              const timer = setInterval(() => {
                current += increment;
                if (current >= stat.target) {
                  current = stat.target;
                  clearInterval(timer);
                }
                setCountUp(prev => ({
                  ...prev,
                  [stat.key]: Math.floor(current)
                }));
              }, 40);
            });
          }
        });
      },
      { threshold: 0.8 }
    );

    const statsSection = document.querySelector('[data-stats]');
    if (statsSection) observer.observe(statsSection);

    return () => observer.disconnect();
  }, [hasAnimated, stats]);

  return (
    <section className="relative py-20 bg-gradient-to-b from-blue-50 to-white overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-yellow-200 rounded-full blur-xl"></div>
      </div>

      <div ref={sectionRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center bg-white px-6 py-3 rounded-full shadow-sm border border-blue-200 mb-6">
            <Star className="w-5 h-5 text-yellow-400 mr-2" />
            <span className="text-blue-700 font-medium">Why Choose Us</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blue-900 mb-4">
            Why Choose <span className="text-yellow-400">Raj Electrical?</span>
          </h2>
          <p className="text-xl text-blue-700 max-w-3xl mx-auto">
            We provide top-tier electrical services with unmatched reliability, safety, and customer care.
          </p>
        </motion.div>

        {/* Feature Cards Grid - 3 equal size cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            const isVisible = visibleCards.has(index);
            const isHovered = hoveredCard === index;
            
            return (
              <motion.div
                key={index}
                data-index={index}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className={`group relative ${isHovered ? 'z-10' : ''}`}
              >
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300`}></div>
                
                {/* Card with fixed height */}
                <div className={`h-full p-1 bg-gradient-to-r ${feature.gradient} rounded-2xl shadow-lg ${isHovered ? feature.glowColor + ' shadow-xl' : ''} transition-all duration-300`}>
                  <div className="bg-white rounded-xl p-8 h-full flex flex-col items-center text-center relative overflow-hidden">
                    {/* Icon */}
                    <div className={`p-4 rounded-full bg-gradient-to-r ${feature.gradient} text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                      <IconComponent className="w-8 h-8" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-blue-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 flex-grow">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats Section - 4 stats */}
        <motion.div
          data-stats
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-xl"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              const currentValue = stat.key === 'service' ? 24 : countUp[stat.key] || 0;
              
              return (
                <motion.div 
                  key={index}
                  whileHover={{ y: -5 }}
                  className="group"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-6 transition-transform duration-300">
                    <IconComponent className="w-8 h-8 text-blue-900" />
                  </div>
                  <p className="text-4xl font-bold text-yellow-400 mb-2">
                    {currentValue}{stat.suffix}
                  </p>
                  <p className="text-blue-200 text-sm">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Call to Action */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="inline-flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            >
              <Users className="mr-2 w-5 h-5" /> Choose Excellence Today
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="border-2 border-yellow-400 text-yellow-500 hover:bg-yellow-400 hover:text-white font-bold py-4 px-8 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center"
            >
              <TrendingUp className="mr-2 w-5 h-5" /> Free Consultation
            </motion.button>
          </div>
        </motion.div> */}
      </div>
    </section>
  );
};

export default WhyChooseUs;