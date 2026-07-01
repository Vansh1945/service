import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
import { formatDate } from '../utils/format';
import { useAuth } from '../context/auth';

const TermsAndConditions = () => {
  const { systemSettings = {} } = useAuth();
  const companyName = systemSettings.companyName || 'Raj Electrical Services';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: 'introduction',
      title: 'Introduction',
      icon: <FileText className="w-5 h-5 text-primary" />,
      content: [
        'We provide a platform to connect users with service providers for various home and professional services.',
        'By using our platform, you agree to comply with these terms and conditions.'
      ]
    },
    {
      id: 'responsibilities',
      title: 'User Responsibilities',
      icon: <UserCheck className="w-5 h-5 text-primary" />,
      content: [
        'Users must provide accurate, current, and complete information during the registration and service booking process.',
        'Misuse of the platform, fraudulent activities, or providing false documentation is strictly prohibited and may lead to legal action.'
      ]
    },
    {
      id: 'booking-payments',
      title: 'Booking & Payments',
      icon: <CreditCard className="w-5 h-5 text-primary" />,
      content: [
        'Users can book services through the platform after agreeing to the estimated service charges.',
        'Payment methods supported include Online (Credit/Debit Cards, UPI, Net Banking) and Pay after Service (where applicable).',
        'The platform reserves the right to charge an advance fee or full payment before the service is initiated for specific high-value tasks.'
      ]
    },
    {
      id: 'cancellation',
      title: 'Cancellation Policy',
      icon: <CalendarX className="w-5 h-5 text-primary" />,
      content: [
        'Users can cancel their booking before the service provider reaches the location.',
        'Cancellations made after the provider has arrived or frequent last-minute cancellations may incur a convenience fee or penalty charges.'
      ]
    },
    {
      id: 'provider-responsibility',
      title: 'Provider Responsibility',
      icon: <ShieldCheck className="w-5 h-5 text-primary" />,
      content: [
        'Service providers are independent professionals responsible for the quality and execution of the service provided.',
        'The platform acts as a mediator to connect users with verified providers and does not directly employ the service personnel.'
      ]
    },
    {
      id: 'liability',
      title: 'Liability',
      icon: <AlertTriangle className="w-5 h-5 text-primary" />,
      content: [
        'The platform is not responsible for the quality of service, damages to property, or any loss incurred during or after the service execution.',
        'We act only as a mediator between the customer and the service provider to facilitate the connection.'
      ]
    },
    {
      id: 'suspension',
      title: 'Account Suspension',
      icon: <UserMinus className="w-5 h-5 text-primary" />,
      content: [
        'Accounts can be suspended or permanently terminated for fraud, platform misuse, violation of any policies, or repeated negative feedback from service providers.'
      ]
    },
    {
      id: 'changes',
      title: 'Changes to Terms',
      icon: <RefreshCw className="w-5 h-5 text-primary" />,
      content: [
        'We reserve the right to update these terms and conditions at any time without prior specific notice.',
        'Users will be notified of major changes through the platform or via email. Continued use of the platform after changes constitutes acceptance.'
      ]
    }
  ];

  const currentDate = formatDate(new Date());

  return (
    <div className="min-h-screen bg-white font-inter">
      <Helmet>
        <title>Terms & Conditions | {companyName}</title>
        <meta name="description" content={`Read the official terms and conditions for booking electrical repair, installations, and home maintenance services with ${companyName}.`} />
        <meta name="keywords" content={`terms and conditions, user agreement, electrical services, ${companyName}`} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={`Terms & Conditions | ${companyName}`} />
        <meta property="og:description" content={`Read the official terms and conditions for booking electrical repair, installations, and home maintenance services with ${companyName}.`} />
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
      <main className="max-w-5xl mx-auto px-4 py-12 md:py-16">
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
        <section className="mt-14 md:mt-20">
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

export default TermsAndConditions;
