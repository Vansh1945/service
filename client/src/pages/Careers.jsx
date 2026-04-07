import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  Clock,
  ArrowRight,
  Wrench,
  TrendingUp,
  Zap,
  CheckCircle,
  Star,
  UserPlus,
  Wallet,
  GraduationCap,
  MapPin,
  Handshake,
  Shield,
  ShieldCheck,
  Award,
  Heart,
  ThumbsUp
} from 'lucide-react';

const CareersPage = () => {
  const stats = [
    { icon: UserPlus, value: "500+", label: "Service Providers" },
    { icon: Wallet, value: "₹50k+", label: "Avg Monthly Earnings" },
    { icon: CheckCircle, value: "100%", label: "Secure Payments" },
    { icon: Zap, value: "24/7", label: "Job Alerts" },
  ];

  const benefits = [
    {
      title: "Earn Extra Money",
      description: "Earn money for every job you finish. No hidden fees, you get paid what you deserve.",
      icon: DollarSign,
    },
    {
      title: "Flexible Work",
      description: "Work when you want and where you want. You are your own boss.",
      icon: Clock,
    },
    {
      title: "Weekly Payouts",
      description: "Get your money in your bank account every week. No long waiting.",
      icon: Wallet,
    },
    {
      title: "Local Jobs",
      description: "Get work near your home and save your travel time every day.",
      icon: MapPin,
    }
  ];

  const steps = [
    {
      title: "Register",
      description: "Fill in your basic details and create your account in just 2 minutes.",
      icon: UserPlus,
    },
    {
      title: "Verify",
      description: "Upload your ID proof and wait for our team to quickly check your profile.",
      icon: ShieldCheck,
    },
    {
      title: "Start Earning",
      description: "Take jobs near your home and start making money right away.",
      icon: TrendingUp,
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Matching AboutPage style */}
      <section className="relative bg-gradient-to-br from-gray-50 to-white pt-20 pb-8 md:pt-28 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-semibold">Join Our Team</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight"
            >
              Start Earning More Today as a
              <span className="block text-primary mt-2">Professional Partner</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-600 max-w-2xl mx-auto mb-8"
            >
              Join our platform to connect with local customers and grow your income with steady work.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/register-provider"
                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Learn More
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section - Matching AboutPage style */}
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

      {/* Main Benefits Grid Section */}
      <section className="pt-8 md:pt-12 pb-8 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our Platform?
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We provide everything you need to build a successful electrical service business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-500">{benefit.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to Get Started Section */}
      <section className="py-10 md:py-16 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How to Get Started</h2>
            <p className="text-gray-600">Three simple steps to start your journey</p>
          </div>

          <div className="relative">
            {/* Connection Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-primary/10 -z-10" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="text-center relative bg-white"
                  >
                    <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 border-8 border-white">
                      <Icon className="w-10 h-10" />
                    </div>
                    <div className="absolute top-0 right-1/2 translate-x-12 bg-white text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-primary/20 shadow-sm">
                      {index + 1}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-10 md:py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Joining Requirements</h2>
              <p className="text-gray-400 mb-10 text-lg">We only hire honest and skilled professionals. To join us, you need:</p>

              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">ID Proof</h3>
                    <p className="text-gray-400">You need a valid ID card to start working with us.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Professional Skills</h3>
                    <p className="text-gray-400">You must have good experience in electrical or repair work.</p>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <Link
                  to="/register-provider"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-primary/90 transition-all transform hover:scale-105"
                >
                  Join Now <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-3xl overflow-hidden ring-4 ring-white/10 shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop"
                  alt="Professional Electrician"
                  className="w-full h-[450px] object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section - Matching AboutPage style */}
      <section className="pt-8 md:pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-primary to-teal-600 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Join hundreds of electrical professionals who have already transformed their careers with our platform
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register-provider"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CareersPage;