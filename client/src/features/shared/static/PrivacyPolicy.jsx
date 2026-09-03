import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
  ArrowRight,
  Info
} from 'lucide-react';
import { formatDate } from '../../../utils/format';
import { useAuth } from '../../../context/auth';

const PrivacyPolicy = () => {
  const { systemSettings = {} } = useAuth();
  const companyName = systemSettings.companyName || 'Raj Electrical Services';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: "info-collect",
      title: "Information We Collect",
      icon: <Database className="w-5 h-5 text-primary" />,
      content: [
        "Customer & Provider Data: Name, mobile number (OTP verified), email address, and service delivery addresses.",
        "KYC & Verification Docs: Live camera selfie, Aadhaar card, PAN card, and bank account/UPI details for payouts.",
        "Location & Device Logs: Real-time GPS location during active service bookings, device IDs, and IP logs."
      ]
    },
    {
      id: "data-use",
      title: "How We Use Your Information",
      icon: <Eye className="w-5 h-5 text-primary" />,
      content: [
        "To match customers with nearby verified service providers and enable live booking status updates.",
        "To verify provider identity, perform KYC background checks, and process automated earnings payouts.",
        "To send push notifications, SMS OTPs, and booking confirmations.",
        "To detect fraud, prevent fake accounts, and resolve customer complaints or safety issues."
      ]
    },
    {
      id: "data-sharing",
      title: "Data Sharing & Disclosure",
      icon: <Share2 className="w-5 h-5 text-primary" />,
      content: [
        "Shared with service providers/customers strictly as needed to complete the booked service (Name, Phone, Address).",
        "Processed securely via payment gateways (e.g. Razorpay) and cloud storage providers.",
        "⚠️ Law Enforcement Compliance: KYC files, location logs, and contact details will be shared with police and legal authorities if required to investigate fraud or safety incidents."
      ]
    },
    {
      id: "data-security",
      title: "Security & Encryption",
      icon: <Lock className="w-5 h-5 text-primary" />,
      content: [
        "End-to-end encryption for stored identity documents and payment information.",
        "Strict access controls: Only authorized admin personnel can review provider KYC documents."
      ]
    },
    {
      id: "cookies",
      title: "Cookies & Session Data",
      icon: <Cookie className="w-5 h-5 text-primary" />,
      content: [
        "We use secure local storage and essential session cookies to keep you logged in and preserve booking states.",
        "You can manage cookie settings in your web browser at any time."
      ]
    },
    {
      id: "user-rights",
      title: "User Rights & Data Control",
      icon: <UserCircle className="w-5 h-5 text-primary" />,
      content: [
        "You can update your profile, phone number, and address anytime from settings.",
        "You have the right to request account deletion or data anonymization by contacting support."
      ]
    },
    {
      id: "contact",
      title: "Contact & Privacy Support",
      icon: <Mail className="w-5 h-5 text-primary" />,
      content: [
        "For any privacy queries, data requests, or support, email us at support@rajelectricalservices.com."
      ]
    }
  ];

  const currentDate = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-white font-inter">
      <Helmet>
        <title>Privacy Policy | {companyName}</title>
        <meta name="description" content={`Understand how ${companyName} collects, protects, and utilizes your user data for booking electrical services.`} />
        <meta name="keywords" content={`privacy policy, data protection, security, ${companyName} privacy`} />
        <link rel="canonical" href="https://rajelectricalservices.vercel.app/privacy-policy" />
        <meta property="og:title" content={`Privacy Policy | ${companyName}`} />
        <meta property="og:description" content={`Understand how ${companyName} collects, protects, and utilizes your user data.`} />
        <meta property="og:url" content="https://rajelectricalservices.vercel.app/privacy-policy" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Privacy Policy | ${companyName}`} />
        <meta name="twitter:description" content={`Understand how ${companyName} collects, protects, and utilizes your user data.`} />
        <meta name="twitter:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta name="twitter:url" content="https://rajelectricalservices.vercel.app/privacy-policy" />
      </Helmet>

      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-primary text-xs font-semibold uppercase tracking-wider">Privacy Protection</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-4xl font-extrabold text-secondary mb-4 tracking-tight"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed"
          >
            Your privacy is important to us. This policy explains how we collect, use, and protect your information to provide you with the best experience.
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4 md:pt-16 md:pb-6">
        <div className="grid gap-6 md:gap-8">
          {sections.map((section, index) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true, margin: '-50px' }}
              className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-primary/5">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-secondary mb-3">
                    {index + 1}. {section.title}
                  </h2>
                  <ul className="space-y-2.5">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 group">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-primary transition-colors shrink-0" />
                        <span className="text-gray-600 text-xs md:text-sm leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {/* Contact CTA */}
        <section className="mt-8 md:mt-10">
          <div className="max-w-3xl mx-auto bg-primary/5 rounded-2xl p-6 md:p-10 text-center border border-primary/10 relative overflow-hidden">
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h3 className="text-lg md:text-xl font-bold text-secondary mb-2">Have questions?</h3>
              <p className="text-gray-500 text-xs md:text-sm mb-6 max-w-md mx-auto leading-relaxed">
                If you have any questions or concerns regarding our privacy practices, please contact us.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Mail className="w-4 h-4" />
                Contact Support
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-6 pt-4 border-t border-gray-100 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-gray-500 font-medium text-xs md:text-sm">
              Last Updated: <span className="text-secondary font-bold">{currentDate}</span>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Bottom Brand Tag */}
      <div className="pb-4 text-center text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold">
        {companyName} • Fairness • Transparency • Trust
      </div>
    </div>
  );
};

export default PrivacyPolicy;
