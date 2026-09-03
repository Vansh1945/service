import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FileText,
  UserCheck,
  CreditCard,
  CalendarX,
  ShieldCheck,
  AlertTriangle,
  UserMinus,
  RefreshCw,
  Mail,
  ArrowRight,
  Info
} from 'lucide-react';
import { formatDate } from '../../../utils/format';
import { useAuth } from '../../../context/auth';

const TermsAndConditions = () => {
  const { systemSettings = {} } = useAuth();
  const companyName = systemSettings.companyName || 'Raj Electrical Services';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: 'introduction',
      title: '1. Platform Scope & Agreement',
      icon: <FileText className="w-5 h-5 text-primary" />,
      content: [
        `Welcome to ${companyName}. We connect customers with verified independent electrical and home service providers.`,
        'By registering, booking, or using our platform, you agree to these Terms & Conditions.'
      ]
    },
    {
      id: 'responsibilities',
      title: '2. User & Customer Responsibilities',
      icon: <UserCheck className="w-5 h-5 text-primary" />,
      content: [
        'Users must provide accurate contact details, service location, and clear description of required work.',
        'Users agree to provide a safe, respectful working environment for service providers.',
        'Bypassing the platform to hire providers directly offline is strictly prohibited.'
      ]
    },
    {
      id: 'provider-onboarding',
      title: '3. Provider Verification & KYC Terms',
      icon: <ShieldCheck className="w-5 h-5 text-primary" />,
      content: [
        'Providers must complete 4-step registration: OTP verification, Live Selfie, identity docs (Aadhaar/PAN), and bank details.',
        'Only Admin-approved providers with complete profiles and verified bank details can accept bookings.',
        'Submitting forged or stolen documents will result in permanent ban and legal action.'
      ]
    },
    {
      id: 'booking-payments',
      title: '4. Bookings, Pricing & Payouts',
      icon: <CreditCard className="w-5 h-5 text-primary" />,
      content: [
        'Service prices are displayed before booking. Additional spare parts or work will be quoted before execution.',
        'Payments can be made online via UPI/Card or Pay After Service.',
        'Provider earnings are credited directly to their registered Bank Account / UPI ID after commission deduction.'
      ]
    },
    {
      id: 'cancellation',
      title: '5. Cancellation & Rescheduling',
      icon: <CalendarX className="w-5 h-5 text-primary" />,
      content: [
        'Free cancellation is available before provider dispatch.',
        'Late cancellations after provider arrival may incur a minor travel convenience charge.'
      ]
    },
    {
      id: 'liability',
      title: '6. Zero Tolerance & Liability Limitation',
      icon: <AlertTriangle className="w-5 h-5 text-primary" />,
      content: [
        'Zero tolerance for theft, violence, property damage, or harassment. Accounts will be banned and reported to police.',
        'The platform acts as a technology marketplace. Independent providers are responsible for executing quality work.'
      ]
    },
    {
      id: 'suspension',
      title: '7. Account Termination & Law Disputes',
      icon: <UserMinus className="w-5 h-5 text-primary" />,
      content: [
        'We reserve the right to suspend or terminate accounts violating safety guidelines, forging KYC, or bypassing payments.',
        'These terms are governed by Indian law and local jurisdiction courts.'
      ]
    }
  ];

  const currentDate = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-white font-inter">
      <Helmet>
        <title>Terms & Conditions | {companyName}</title>
        <meta name="description" content={`Read the official terms and conditions for booking electrical repair, installations, and home maintenance services with ${companyName}.`} />
        <meta name="keywords" content={`terms and conditions, user agreement, electrical services, ${companyName}`} />
        <link rel="canonical" href="https://rajelectricalservices.vercel.app/terms-and-conditions" />
        <meta property="og:title" content={`Terms & Conditions | ${companyName}`} />
        <meta property="og:description" content={`Read the official terms and conditions for booking electrical repair, installations, and home maintenance services with ${companyName}.`} />
        <meta property="og:url" content="https://rajelectricalservices.vercel.app/terms-and-conditions" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Terms & Conditions | ${companyName}`} />
        <meta name="twitter:description" content={`Read the official terms and conditions for booking electrical repair, installations, and home maintenance services with ${companyName}.`} />
        <meta name="twitter:image" content="https://rajelectricalservices.vercel.app/og-image.jpg" />
        <meta name="twitter:url" content="https://rajelectricalservices.vercel.app/terms-and-conditions" />
      </Helmet>

      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
          >
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-primary text-xs font-semibold uppercase tracking-wider">Legal Agreement</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl md:text-4xl font-extrabold text-secondary mb-4 tracking-tight"
          >
            Terms & Conditions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto leading-relaxed"
          >
            Please read these terms carefully before using our platform. By accessing or using our services, you agree to be bound by these terms.
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
                  <div className="space-y-4">
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
                If you have any questions about our Terms & Conditions, please don't hesitate to reach out to our support team.
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

export default TermsAndConditions;
