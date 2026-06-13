import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import HeroSection from '../components/HeroSection';
import Services from './Services';
import { useAuth } from '../context/auth';
import {
  ShieldCheck,
  Clock,
  Award,
  Zap,
  ChevronDown,
  MapPin,
  ThumbsUp,
  CheckCircle2,
  Users
} from 'lucide-react';
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'framer-motion';

const Home = () => {
  const { systemSettings = {} } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const prefersReducedMotion = useReducedMotion();

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What types of residential electrical services do you offer?",
      a: "We offer comprehensive residential electrical services in North India, including full house wiring, smart home installations, panel upgrades, detailed safety audits, lighting designs, and 24/7 professional electrical repair for any sudden faults."
    },
    {
      q: "Are your electricians certified and background-verified?",
      a: "Yes! Every electrician on our platform undergoes rigorous training, background verification, and identity checks. We hold safety and quality standards as our absolute priority to ensure maximum peace of mind for our residential and commercial clients."
    },
    {
      q: "Do you offer emergency electrical support?",
      a: "Absolutely. We understand that electrical faults can be hazardous. We provide rapid-response emergency electrical support across North India for critical issues such as short circuits, sparking, sudden power failures, and burning smells."
    },
    {
      q: "How does your pricing work?",
      a: "We offer clear, transparent, and upfront pricing. Before starting any job, the provider provides a detailed cost estimate based on standard rate lists. There are absolutely no hidden fees or surprise costs."
    }
  ];

  return (
    <div className="overflow-hidden bg-transparent">
      <Helmet>
        <title>{systemSettings.companyName || "Raj Electrical Services"} | Trusted Electrical Services in North India</title>
        <meta name="description" content={`Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Safe, reliable, and affordable services in North India.`} />
        <meta name="keywords" content="electrical services in North India, professional electrical repair, home electrical maintenance, residential and commercial electrical services, trusted electrical solutions" />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={`${systemSettings.companyName || "Raj Electrical Services"} | Trusted Electrical Services in North India`} />
        <meta property="og:description" content={`Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Safe, reliable, and affordable services in North India.`} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <HeroSection />

      {/* Limited Services Section */}
      <Services />


      {/* Why Choose Us Section */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
              Trust & Quality
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-secondary mt-3 mb-2 font-poppins">
              Why Choose {systemSettings.companyName || "Raj Electrical Services"}?
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
              We standardise quality, safety, and reliability for all your home and office electrical maintenance needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: "100% Safe & Insured",
                desc: "Safety is our priority. We employ high-grade safety protocols and certified diagnostic tools."
              },
              {
                icon: Clock,
                title: "Prompt Emergency Support",
                desc: "Immediate assistance for short circuits, power failures, and hazardous sparking."
              },
              {
                icon: Award,
                title: "Background-Verified Experts",
                desc: "Strict verification ensures highly-skilled and polite professional electricians."
              },
              {
                icon: ThumbsUp,
                title: "No Hidden Costs",
                desc: "Upfront pricing estimates so you pay precisely what was agreed on. No surprises."
              }
            ].map((benefit, idx) => {
              const IconComponent = benefit.icon;
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-secondary mb-2 font-poppins">{benefit.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-normal">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Service Coverage Section */}
      <section className="py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-primary to-teal-800 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <MapPin className="w-48 h-48 -mr-12 -mt-12 text-white" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <span className="text-[10px] uppercase tracking-widest font-black bg-white/20 px-3 py-1 rounded-lg">
                Active Operations
              </span>

              <h2 className="text-2xl md:text-3xl font-bold mt-4 mb-4 font-poppins">
                Reliable Electrical Services
              </h2>

              <p className="text-white/90 text-sm leading-relaxed mb-6 font-normal">
                {systemSettings.companyName || "Raj Electrical Services"} connects customers with verified electrical professionals for residential, commercial, and emergency electrical needs. Our focus is on quality workmanship, transparent service, and customer satisfaction.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  "Verified Professionals",
                  "Quality Service Standards",
                  "Residential & Commercial Solutions",
                  "Dedicated Customer Support",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-xs font-semibold text-white/90">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
              Common Queries
            </span>
            <h2 className="text-2xl font-extrabold text-secondary mt-3 mb-2 font-poppins">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-xs font-semibold">
              Find instant answers to typical booking and safety inquiries.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-gray-150 overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none"
                >
                  <span className="text-sm font-bold text-secondary font-poppins">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${openFaq === idx ? 'transform rotate-180 text-primary' : ''}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <LazyMotion features={domAnimation}>
                      <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                      >
                        <div className="px-6 pb-4 text-xs text-gray-500 leading-relaxed font-normal border-t border-gray-50 pt-3">
                          {faq.a}
                        </div>
                      </m.div>
                    </LazyMotion>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
