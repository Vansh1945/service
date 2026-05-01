import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Database,
  Eye,
  Share2,
  Lock,
  Cookie,
  UserCircle,
  Mail,
  ChevronRight,
  Info,
  ArrowRight
} from 'lucide-react';
import { formatDate } from '../utils/format';

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = "Privacy Policy | SAFEVOLT SOLUTIONS";
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: "info-collect",
      title: "1. Information We Collect",
      icon: <Database className="w-6 h-6" />,
      content: [
        "Name",
        "Email Address",
        "Phone Number",
        "Location Data",
        "Payment Information"
      ]
    },
    {
      id: "data-use",
      title: "2. How We Use Your Data",
      icon: <Eye className="w-6 h-6" />,
      content: [
        "To process and manage your service bookings",
        "To provide customer support and respond to your inquiries",
        "To improve our platform services and user experience",
        "For marketing and communication purposes (optional and based on your preferences)"
      ]
    },
    {
      id: "data-sharing",
      title: "3. Data Sharing",
      icon: <Share2 className="w-6 h-6" />,
      content: [
        "We may share your data with trusted third-party service providers who assist us in operating our platform.",
        "Example: Secure payment gateways like Razorpay for processing transactions.",
        "We do not sell your personal data to any third parties for marketing purposes."
      ]
    },
    {
      id: "data-security",
      title: "4. Data Security",
      icon: <Lock className="w-6 h-6" />,
      content: [
        "We implement robust security measures to protect your personal information from unauthorized access.",
        "Industry-standard encryption and secure storage practices are utilized to ensure data integrity."
      ]
    },
    {
      id: "cookies",
      title: "5. Cookies",
      icon: <Cookie className="w-6 h-6" />,
      content: [
        "We use cookies to enhance your browsing experience and remember your preferences.",
        "Users have the option to disable cookies through their browser settings, though some platform features may be affected."
      ]
    },
    {
      id: "user-rights",
      title: "6. User Rights",
      icon: <UserCircle className="w-6 h-6" />,
      content: [
        "Users can request the deletion of their personal data from our systems.",
        "Users have the right to update or correct their information at any time through their profile settings.",
        "Users are free to delete their account if they no longer wish to use our services."
      ]
    },
    {
      id: "contact",
      title: "7. Contact Information",
      icon: <Mail className="w-6 h-6" />,
      content: [
        "If you have any privacy-related concerns or questions, please reach out to us."
      ]
    }
  ];

  const currentDate = formatDate(new Date());

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Header Section */}
      <section className="bg-gradient-to-br from-gray-50 to-white pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
          >
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-primary text-sm font-semibold tracking-wide uppercase">Privacy Protection</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-extrabold text-secondary mb-6 tracking-tight"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed"
          >
            Your privacy is important to us. This policy explains how we collect, use, and protect your information to provide you with the best experience.
          </motion.p>
        </div>
      </section>

      {/* Main Content Sections */}
      <main className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-8 md:gap-12">
          {sections.map((section, index) => (
            <motion.section
              key={section.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  {section.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-secondary mb-5 flex items-center gap-3">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {section.content.map((item, i) => (
                      <div key={i} className="flex items-start gap-4 group">
                        <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-gray-600 text-base md:text-lg leading-relaxed -ml-8 group-hover:ml-0 transition-all duration-300">
                          {section.id === 'contact' && i === 1 ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
                              <Link
                                to="/contact"
                                className="inline-flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
                              >
                                Visit Contact Page <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          ) : item}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 pt-8 border-t border-gray-100 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
            <Info className="w-4 h-4 text-gray-400" />
            <p className="text-gray-500 font-medium text-sm md:text-base">
              Last Updated: <span className="text-secondary font-bold">{currentDate}</span>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
