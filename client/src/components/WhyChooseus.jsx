import React, { useState, useEffect, useRef } from 'react';
import { Award, DollarSign, Shield, Star, CheckCircle2, Heart, Clock } from 'lucide-react';

const WhyChooseUs = () => {
  const [visibleCards, setVisibleCards] = useState(new Set());
  const [countUp, setCountUp] = useState({ 
    projects: 0, 
    satisfaction: 0,
    service: 0,
    experience: 0
  });
  const sectionRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  const features = [
    {
      icon: Award,
      title: "Experienced Electricians",
      description: "Our team of skilled electricians brings years of expertise to every project, ensuring professional and reliable service.",
      gradient: "from-primary to-primary/70",
      glowColor: "shadow-primary/40"
    },
    {
      icon: DollarSign,
      title: "Affordable Pricing",
      description: "No hidden charges. We offer competitive rates with transparent pricing for all services.",
      gradient: "from-accent to-accent/70",
      glowColor: "shadow-accent/40"
    },
    {
      icon: Shield,
      title: "Safety & Quality Guarantee",
      description: "We prioritize safety with strict protocols and guarantee high-quality workmanship on all electrical installations and repairs.",
      gradient: "from-primary/70 to-primary",
      glowColor: "shadow-primary/40"
    }
  ];

  const stats = [
    { key: 'projects', target: 500, suffix: '+', label: 'Projects Completed', icon: CheckCircle2 },
    { key: 'satisfaction', target: 99, suffix: '%', label: 'Customer Satisfaction', icon: Heart },
    { key: 'service', target: 24, suffix: '/7', label: 'Emergency Service', icon: Clock },
    { key: 'experience', target: 20, suffix: '+', label: 'Years Experience', icon: Award }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardIndex = parseInt(entry.target.dataset.index);
            setTimeout(() => {
              setVisibleCards(prev => new Set([...prev, cardIndex]));
            }, cardIndex * 200);
          }
        });
      },
      { threshold: 0.25 }
    );

    const cards = sectionRef.current?.querySelectorAll('[data-index]');
    cards?.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasAnimated) return;

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
              }, 30);
            });
          }
        });
      },
      { threshold: 0.85 }
    );

    const statsSection = document.querySelector('[data-stats]');
    if (statsSection) observer.observe(statsSection);
    return () => observer.disconnect();
  }, [hasAnimated, stats]);

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 bg-transparent overflow-hidden font-poppins">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-24 left-12 w-36 h-36 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-24 right-12 w-48 h-48 bg-accent/20 rounded-full blur-3xl"></div>
      </div>

      <div ref={sectionRef} className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-14 sm:mb-20">
          <div className="inline-flex items-center bg-white bg-opacity-20 backdrop-blur-md px-5 py-3 rounded-full shadow-md border border-primary/30 mb-6">
            <Star className="w-4 h-4 text-accent mr-3" />
            <span className="text-primary font-semibold text-md tracking-wide">Why Choose Us</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-secondary mb-4 px-4">
            Why Choose <span className="text-accent">Raj Electrical?</span>
          </h2>
          <p className="text-lg sm:text-xl text-secondary/90 max-w-4xl mx-auto px-4 leading-relaxed">
            We provide top-tier electrical services with unmatched reliability, safety, and customer care.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            const isVisible = visibleCards.has(index);
            
            return (
              <div
                key={index}
                data-index={index}
                className={`relative rounded-3xl transform-gpu transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 pointer-events-none`}></div>
                <div className={`h-full p-1 bg-gradient-to-r ${feature.gradient} rounded-3xl shadow-lg transition-all duration-500`}>
                  <div className="bg-white bg-opacity-90 rounded-3xl p-10 h-full flex flex-col items-center text-center relative overflow-hidden shadow-md">
                    <div className={`p-5 rounded-full bg-gradient-to-r ${feature.gradient} text-white mb-8 transition-transform duration-500 shadow-lg`}>
                      <IconComponent className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-semibold text-secondary mb-3">{feature.title}</h3>
                    <p className="text-secondary/80 flex-grow leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          data-stats
          className="mt-12 sm:mt-16 mx-4 bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              const currentValue = stat.key === 'service' ? 24 : countUp[stat.key] || 0;
              
              return (
                <div key={index}>
                  <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/90 rounded-3xl flex items-center justify-center mx-auto mb-3 transition-transform duration-500">
                    <IconComponent className="w-6 h-6 text-background" />
                  </div>
                  <p className="text-2xl font-extrabold text-accent mb-2">
                    {currentValue}{stat.suffix}
                  </p>
                  <p className="text-white text-sm font-semibold tracking-wide">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
