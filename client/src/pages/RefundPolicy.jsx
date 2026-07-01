import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth';
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
import { formatDate } from '../utils/format';

const RefundPolicy = () => {
  const { systemSettings = {} } = useAuth();
  const companyName = systemSettings.companyName || 'Raj Electrical Services';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "Refund Eligibility",
      icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
      description: "Refund will be provided in the following cases:",
      items: [
        "Service cancelled before execution",
        "Service provider does not show up",
        "Poor or unsatisfactory service"
      ],
      bgColor: "bg-primary/5"
    },
    {
      title: "Non-Refund Cases",
      icon: <XCircle className="w-5 h-5 text-danger" />,
      description: "Refund will NOT be provided if:",
      items: [
        "Service has been successfully completed",
        "Cancellation is done at the last moment"
      ],
      bgColor: "bg-danger/5"
    },
    {
      title: "Refund Time",
      icon: <Clock className="w-5 h-5 text-accent" />,
      description: "Refunds will be processed within 5–7 working days after approval.",
      bgColor: "bg-accent/5"
    },
    {
      title: "Payment Method Refund",
      icon: <CreditCard className="w-5 h-5 text-primary" />,
      description: "Refund will be credited to the original payment method used during booking.",
      bgColor: "bg-primary/5"
    },
    {
      title: "Cancellation Charges",
      icon: <AlertCircle className="w-5 h-5 text-warning" />,
      description: "Important notes on cancellations:",
      items: [
        "Last-minute cancellations may incur partial charges",
        "Applicable fees will be deducted before processing refund"
      ],
      bgColor: "bg-warning/5"
    }
  ];

  const currentDate = formatDate(new Date());

  return (
    <div className="min-h-screen bg-white font-inter">
      <Helmet>
        <title>Refund Policy | {companyName}</title>
        <meta name="description" content={`Read our transparent refund and cancellation policy details for bookings made with ${companyName}.`} />
        <meta name="keywords" content={`refund policy, cancel booking, ${companyName} refund`} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={`Refund Policy | ${companyName}`} />
        <meta property="og:description" content={`Read our transparent refund and cancellation policy details for bookings made with ${companyName}.`} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
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
      <main className="max-w-5xl mx-auto px-4 py-12 md:py-16">
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
                <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white shadow-sm">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-secondary mb-3">
                    {section.title}
                  </h2>
                  <p className="text-gray-700 text-xs md:text-sm font-medium mb-3 leading-relaxed">
                    {section.description}
                  </p>
                  {section.items && (
                    <ul className="space-y-2.5">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 group">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:bg-primary transition-colors shrink-0" />
                          <span className="text-gray-600 text-xs md:text-sm leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.section>
          ))}

          {/* Guarantee Highlight Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-secondary p-6 md:p-8 rounded-2xl text-white shadow-lg relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-32 h-32 -mr-6 -mt-6" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-base md:text-lg font-bold mb-2">Our Commitment to Satisfaction</h3>
              <p className="text-gray-300 text-xs md:text-sm leading-relaxed">
                At {companyName}, we value your trust. If you're not satisfied with a service, our support team will work tirelessly to resolve the issue or process your refund as per our transparent guidelines.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Contact CTA */}
        <section className="mt-14 md:mt-20">
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
          className="mt-12 pt-6 border-t border-gray-100 text-center"
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
      <div className="pb-10 text-center text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold">
        {companyName} • Fairness • Transparency • Trust
      </div>
    </div>
  );
};

export default RefundPolicy;
