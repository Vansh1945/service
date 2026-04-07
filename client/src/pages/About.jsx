import React from 'react';
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
                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
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
              className="inline-flex items-center gap-2 bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
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