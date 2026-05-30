import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Zap, Award, Shield, MapPin, Phone, Users, CheckCircle,
  ArrowRight, Heart, Star, Clock, ThumbsUp, Home, Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutPage = () => {
  const stats = [
    { icon: Award, value: "15+", label: "Years Experience" },
    { icon: Users, value: "10k+", label: "Happy Customers" },
    { icon: Briefcase, value: "500+", label: "Providers" },
    { icon: MapPin, value: "50+", label: "Cities Covered" },
  ];

  const whyWeStarted = [
    {
      icon: Shield,
      title: "Building Trust",
      description: "Started to bring transparency and reliability to the unorganized service sector."
    },
    {
      icon: Clock,
      title: "Valuing Time",
      description: "Created to eliminate unpredictable wait times with systematic scheduling."
    },
    {
      icon: ThumbsUp,
      title: "Ensuring Quality",
      description: "Driven to standardize service quality and ensure professional execution."
    },
    {
      icon: Heart,
      title: "Customer First",
      description: "Built to create an experience where your peace of mind is the ultimate priority."
    },
  ];

  const teamMembers = [
    { name: "Rahul Sharma", role: "Founder & CEO" },
    { name: "Priya Singh", role: "Head of Operations" },
    { name: "Amit Kumar", role: "Technical Lead" },
    { name: "Neha Gupta", role: "Customer Success" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>About Us | Raj Electrical Services | Premium Electricians in North India</title>
        <meta name="description" content="Learn about Raj Electrical Services, the leading provider of professional electrical repair, home electrical maintenance, and residential & commercial support across North India." />
        <meta name="keywords" content="electrical services in North India, professional electrical repair, home electrical maintenance, trusted electrical solutions, about Raj Electrical" />
        <link rel="canonical" href="https://rajelectricalservices.vercel.app/about" />
        <meta property="og:title" content="About Us | Raj Electrical Services | Premium Electricians in North India" />
        <meta property="og:description" content="Learn about Raj Electrical Services, the leading provider of professional electrical repair, home electrical maintenance, and residential & commercial support across North India." />
        <meta property="og:url" content="https://rajelectricalservices.vercel.app/about" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-50 to-white pt-20 pb-8 md:pt-28 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-semibold">About Us</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight"
            >
              Your Trusted Electrical Partner
              <span className="block text-primary mt-2">in North India</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-600 max-w-2xl mx-auto mb-8"
            >
              Professional electrical services with 15+ years of expertise, serving thousands of happy customers across Himachal Pradesh and Punjab
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
              >
                Get Free Quote <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                View Services
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-3">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Company Story */}
      <section className="pt-8 md:pt-12 pb-8 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full mb-4">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-primary text-xs font-semibold">Our Story</span>
              </div>
              <p className="text-gray-600 mb-4 leading-relaxed">
                It started simple — a small team of electricians who were tired of seeing people struggle to find good, honest service. Customers were either overcharged or left with poor quality work.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                So we decided to do something about it. We built a platform where skilled local electricians could connect directly with homeowners and businesses across Himachal Pradesh and Punjab.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Today, we have over 500 verified providers and 10,000+ happy customers — and we're just getting started.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="Our electrician at work"
                  className="w-full h-[420px] object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-white rounded-lg shadow-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Himachal & Punjab</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-10 md:py-16 bg-gradient-to-br from-primary/5 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full mb-4">
              <Star className="w-3 h-3 text-primary" />
              <span className="text-primary text-xs font-semibold">What Drives Us</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Mission & Vision</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Simple goals, big impact.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-5">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Our Mission</h3>
              <p className="text-gray-600 leading-relaxed">
                To make getting a good electrician as easy as ordering food online. Fast, reliable, and affordable — every single time.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-5">
                <Star className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Our Vision</h3>
              <p className="text-gray-600 leading-relaxed">
                To become the most trusted home service platform in North India, where every provider earns well and every customer smiles.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      {/* <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Our dedicated team"
                className="rounded-2xl shadow-lg w-full h-[350px] object-cover hover:scale-105 transition-transform duration-700"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Meet Our Team
              </h2>
              <p className="text-gray-600 mb-6">
                A passionate group of professionals driving our vision forward and ensuring excellence in every project.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {teamMembers.map((member, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-gray-100 py-3">
                    <span className="text-gray-700">{member.name}</span>
                    <span className="font-semibold text-primary">{member.role}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-600">Expert Leadership</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-sm text-gray-600">Dedicated Support</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section> */}

      {/* ── Supplementary SEO Sections ── */}

      {/* Professional Electrical Solutions Section */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
              Enterprise Care
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-secondary mt-3 mb-2 font-poppins">
              Professional Electrical Solutions
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
              We cater to both domestic maintenance demands and heavy-duty commercial/industrial electrical infrastructures.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Residential Installations",
                features: ["Smart switches & lighting design", "Comprehensive safety audits", "Full-scale house wiring & rewiring"]
              },
              {
                title: "Commercial Maintenance",
                features: ["Panel upgrades & phase balancing", "Server room electrical backups", "Industrial compliance checking"]
              },
              {
                title: "24/7 Diagnostics & Repairs",
                features: ["Short circuit thermal scanning", "Leakage current protection installs", "Appliance overloading diagnostics"]
              }
            ].map((sol, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold text-secondary mb-4 font-poppins">{sol.title}</h3>
                <ul className="space-y-3">
                  {sol.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety & Quality Standards Section */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
                Zero Compromise
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-secondary mt-4 mb-4 font-poppins">
                Our Rigid Safety & Quality Standards
              </h2>
              <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-6">
                Electricity is a powerful element. We treat it with the absolute respect it demands by enforcing strict code compliance, premium materials inspection, and regular skill recalibration for all our certified North India technicians.
              </p>

              <div className="space-y-4">
                {[
                  { title: "Calibrated Diagnostic Gear", desc: "Our teams use top-grade insulation testers and advanced digital multimeters." },
                  { title: "Compulsory Safety Gear", desc: "No technician operates without insulated gloves, rubber-sole safety shoes, and protective goggles." },
                  { title: "Quality Checklists", desc: "Every wiring and repair task is validated against a rigorous multi-point testing checklist." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-secondary font-poppins">{item.title}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                <img 
                  src="https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=800" 
                  alt="Safety audit checking" 
                  className="w-full h-[320px] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pt-8 md:pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-primary to-teal-600 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Need Professional Electrical Service?
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Get a free quote today. Quick response, transparent pricing, and quality guaranteed.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
            >
              <Phone className="w-4 h-4" />
              Contact Us Today
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;