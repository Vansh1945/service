import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import Services from './Services';
import { useAuth } from '../context/auth';
import {
  ShieldCheck,
  Clock,
  Award,
  Zap,
  CheckCircle2,
  Users,
  Headphones,
  Receipt
} from 'lucide-react';
import electricanimg from "../assets/electrician.png"

const Home = () => {
  const { systemSettings = {} } = useAuth();

  const features = [
    {
      icon: ShieldCheck,
      title: "Verified Professionals",
      desc: "Background checked experts",
      bgColor: "bg-teal-50 text-teal-600 border border-teal-100/50"
    },
    {
      icon: Clock,
      title: "On-Time Service",
      desc: "Punctual & reliable",
      bgColor: "bg-amber-50 text-amber-600 border border-amber-100/50"
    },
    {
      icon: Receipt,
      title: "Upfront Pricing",
      desc: "No hidden charges",
      bgColor: "bg-blue-50 text-blue-600 border border-blue-100/50"
    },
    {
      icon: CheckCircle2,
      title: "Satisfaction Guarantee",
      desc: "Quality service assured",
      bgColor: "bg-green-50 text-green-600 border border-green-100/50"
    },
    {
      icon: Headphones,
      title: "24/7 Support",
      desc: "We're here to help",
      bgColor: "bg-indigo-50 text-indigo-600 border border-indigo-100/50"
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

      {/* Trust Badges / Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 mb-2">
        <div className="flex overflow-x-auto gap-4 pb-2 lg:pb-0 lg:grid lg:grid-cols-5 scrollbar-hide snap-x snap-mandatory">
          {features.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 min-w-[260px] sm:min-w-[280px] lg:min-w-0 flex-shrink-0 snap-start"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.bgColor}`}>
                  <IconComponent className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-secondary font-poppins leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-tight">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Limited Services Section */}
      <Services />


      {/* Why Choose Us Section */}
      <section className="py-8 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-extrabold text-secondary font-poppins leading-tight">
                Why Choose {systemSettings.companyName || "Raj Electrical Service"}?
              </h2>
              <p className="text-gray-500 text-sm font-medium leading-relaxed">
                We deliver safe, reliable and high-quality electrical solutions with a customer-first approach.
              </p>

              <div className="space-y-4 pt-2">
                {[
                  {
                    title: "Experienced & Skilled Technicians",
                    desc: "Trained experts with years of experience"
                  },
                  {
                    title: "Safe & Reliable Work",
                    desc: "We follow safety standards and best practices"
                  },
                  {
                    title: "Transparent Pricing",
                    desc: "Clear quotes with no hidden costs"
                  },
                  {
                    title: "Customer Satisfaction",
                    desc: "Thousands of happy customers trust us"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border border-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-teal-600 font-bold text-xs">✓</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-secondary font-poppins">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  to="/about"
                  className="inline-block bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-sm shadow-teal-950/20 active:scale-95"
                >
                  Learn More About Us
                </Link>
              </div>
            </div>

            {/* Right Column - Image & Floating Cards */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[440px] aspect-[4/3] rounded-3xl overflow-hidden shadow-xl border border-gray-100">
                <img
                  src={electricanimg}
                  alt="Professional Electrician"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Floating Badge 1 - Happy Customers */}
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl p-3 shadow-xl border border-gray-100/50 flex flex-col gap-1.5 z-10 animate-fade-in min-w-[120px]">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-secondary font-poppins">10,000+</span>
                </div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Happy Customers</span>

                {/* Avatars */}
                <div className="flex -space-x-1.5 overflow-hidden">
                  <img className="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format&q=80" alt="avatar" />
                  <img className="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&fit=crop&auto=format&q=80" alt="avatar" />
                  <img className="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&fit=crop&auto=format&q=80" alt="avatar" />
                  <img className="inline-block h-5 w-5 rounded-full ring-2 ring-white" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&auto=format&q=80" alt="avatar" />
                </div>
              </div>

              {/* Floating Badge 2 - Customer Rating */}
              <div className="absolute -right-4 bottom-8 bg-white rounded-2xl p-3 shadow-xl border border-gray-100/50 flex flex-col gap-1 z-10 animate-fade-in min-w-[110px]">
                <span className="text-sm font-black text-secondary font-poppins">4.8/5</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Customer Rating</span>
                <div className="flex text-amber-500 gap-0.5">
                  {"★".repeat(5).split("").map((star, i) => (
                    <span key={i} className="text-xs">{star}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Ribbon Strip */}
      <section className="bg-teal-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center divide-x-0 md:divide-x divide-teal-800">
            {[
              {
                icon: Users,
                value: "10,000+",
                label: "Happy Customers"
              },
              {
                icon: ShieldCheck,
                value: "25+",
                label: "Expert Technicians"
              },
              {
                icon: Zap,
                value: "50+",
                label: "Services Available"
              },
              {
                icon: Award,
                value: "5+",
                label: "Years of Experience"
              }
            ].map((stat, idx) => {
              const IconComponent = stat.icon;
              return (
                <div key={idx} className="flex items-center gap-3 justify-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <IconComponent className="w-5.5 h-5.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black font-poppins leading-none">
                      {stat.value}
                    </h3>
                    <p className="text-[10px] md:text-xs text-white/80 font-medium mt-1">
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Need Help Banner */}
      <section className="py-6 bg-teal-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-teal-50/70 border border-teal-100/50 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-teal-600 flex items-center justify-center shrink-0 bg-teal-100/30">
                <span className="text-teal-600 font-bold text-sm">?</span>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-extrabold text-secondary font-poppins">
                  Need Help with Electrical Work?
                </h3>
                <p className="text-[11px] md:text-xs text-gray-500 font-medium mt-0.5">
                  Book trusted electricians for your home or office – fast, reliable & affordable.
                </p>
              </div>
            </div>
            <Link
              to="/customer/services-list"
              className="w-full md:w-auto bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-sm shadow-teal-950/20 active:scale-95 text-center flex items-center justify-center gap-2"
            >
              Book Service Now
              <span className="text-sm">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
