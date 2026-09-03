import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/auth';
import {
  RefreshCcw,
  XCircle,
  Clock,
  CreditCard,
  AlertCircle,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';

const RefundPolicy = () => {
  const { systemSettings = {} } = useAuth();
  const companyName = systemSettings.companyName || 'Raj Electrical Services';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "100% Refund Eligibility",
      icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
      description: "Full refunds are guaranteed under the following conditions:",
      items: [
        "Booking cancelled by customer before a provider is dispatched.",
        "Provider No-Show (provider fails to arrive within 30 minutes of scheduled time).",
        "Booking cancelled by the provider or system due to provider unavailability.",
        "Unsatisfactory service or verified property damage after internal safety review."
      ],
      bgColor: "bg-primary/5"
    },
    {
      title: "Non-Refundable Scenarios",
      icon: <XCircle className="w-5 h-5 text-danger" />,
      description: "Refunds will not be applicable under these circumstances:",
      items: [
        "Service is fully completed and confirmed by the customer.",
        "Cancellation after the provider has already arrived at the customer location (travel fee applies).",
        "Direct cash payments made offline outside the platform payment gateway."
      ],
      bgColor: "bg-danger/5"
    },
    {
      title: "Cancellation Fee & Travel Allowance",
      icon: <AlertCircle className="w-5 h-5 text-warning" />,
      description: "If a booking is cancelled after the provider is en route or at your doorstep, a nominal travel compensation fee (₹50 - ₹100) will be deducted to compensate the provider's travel time.",
      bgColor: "bg-warning/5"
    },
    {
      title: "Refund Processing Timelines",
      icon: <Clock className="w-5 h-5 text-accent" />,
      description: "Approved refunds are processed instantly and credited back to your original payment source (UPI, Credit/Debit Card, Net Banking) or platform wallet within 3 to 5 business days.",
      bgColor: "bg-accent/5"
    },
    {
      title: "Disputes & Support Claim",
      icon: <Mail className="w-5 h-5 text-primary" />,
      description: "To report an issue or claim a refund, go to 'My Bookings' -> 'Report Issue' or contact support within 24 hours of service completion.",
      bgColor: "bg-primary/5"
    }
  ];

  const currentDate = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-white font-inter">
      <Helmet>
        <title>Refund Policy | {companyName}</title>
        <meta name="description" content={`Read our transparent refund and cancellation policy details for bookings made with ${companyName}.`} />
        <meta name="keywords" content={`refund policy, cancel booking, ${companyName} refund`} />
        <link rel="canonical" href="https://rajelectricalservices.vercel.app/refund-policy" />
        <meta property="og:title" content={`Refund Policy | ${companyName}`} />
        <meta property="og:description" content={`Read our transparent refund and cancellation policy details for bookings made with ${companyName}.`} />
        <meta property="og:url" content="https://rajelectricalservices.vercel.app/refund-policy" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Refund Policy | ${companyName}`} />
        <meta name="twitter:description" content={`Read our transparent refund and cancellation policy details for bookings made with ${companyName}.`} />
        <meta name="twitter:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta name="twitter:url" content="https://rajelectricalservices.vercel.app/refund-policy" />
      </Helmet>

      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
          >
            <RefreshCcw className="w-4 h-4 text-primary" />
            <span className="text-primary text-xs font-semibold uppercase tracking-wider">Refund Center</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-4xl font-extrabold text-secondary mb-4 tracking-tight"
          >
            Refund Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed"
          >
            Understand our refund and cancellation terms clearly to ensure a smooth experience with our services.
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4 md:pt-16 md:pb-6">
        <div className="grid gap-6 md:gap-8">
          {sections.map((section, index) => (
            <motion.section
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true, margin: '-50px' }}
              className={`rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 ${section.bgColor}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white shadow-sm border border-gray-50">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-secondary mb-3">
                    {index + 1}. {section.title}
                  </h2>
                  <p className="text-gray-700 text-xs md:text-sm font-medium mb-3 leading-relaxed">
                    {section.description}
                  </p>
                  {section.items && (
                    <ul className="space-y-2.5">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 group">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-primary transition-colors shrink-0" />
                          <span className="text-gray-600 text-xs md:text-sm leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                If you encounter any issues with a booking or have specific queries about a refund, we're here to help you.
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

export default RefundPolicy;
