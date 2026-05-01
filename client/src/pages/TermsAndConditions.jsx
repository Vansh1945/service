import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  UserCheck, 
  CreditCard, 
  CalendarX, 
  ShieldCheck, 
  AlertTriangle, 
  UserMinus, 
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { formatDate } from '../utils/format';

const TermsAndConditions = () => {
  useEffect(() => {
    document.title = "Terms & Conditions | SAFEVOLT SOLUTIONS";
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: "introduction",
      title: "1. Introduction",
      icon: <FileText className="w-5 h-5" />,
      content: "We provide a platform to connect users with service providers for various home and professional services. By using our platform, you agree to comply with these terms and conditions."
    },
    {
      id: "responsibilities",
      title: "2. User Responsibilities",
      icon: <UserCheck className="w-5 h-5" />,
      content: [
        "Users must provide accurate, current, and complete information during the registration and service booking process.",
        "Misuse of the platform, fraudulent activities, or providing false documentation is strictly prohibited and may lead to legal action."
      ]
    },
    {
      id: "booking-payments",
      title: "3. Booking & Payments",
      icon: <CreditCard className="w-5 h-5" />,
      content: [
        "Users can book services through the platform after agreeing to the estimated service charges.",
        "Payment methods supported include Online (Credit/Debit Cards, UPI, Net Banking) and Cash on Delivery (where applicable).",
        "The platform reserves the right to charge an advance fee or full payment before the service is initiated for specific high-value tasks."
      ]
    },
    {
      id: "cancellation",
      title: "4. Cancellation Policy",
      icon: <CalendarX className="w-5 h-5" />,
      content: [
        "Users can cancel their booking before the service provider reaches the location.",
        "Cancellations made after the provider has arrived or frequent last-minute cancellations may incur a convenience fee or penalty charges."
      ]
    },
    {
      id: "provider-responsibility",
      title: "5. Provider Responsibility",
      icon: <ShieldCheck className="w-5 h-5" />,
      content: [
        "Service providers are independent professionals responsible for the quality and execution of the service provided.",
        "The platform acts as a mediator to connect users with verified providers and does not directly employ the service personnel."
      ]
    },
    {
      id: "liability",
      title: "6. Liability",
      icon: <AlertTriangle className="w-5 h-5" />,
      content: [
        "The platform is not responsible for the quality of service, damages to property, or any loss incurred during or after the service execution.",
        "We act only as a mediator between the customer and the service provider to facilitate the connection."
      ]
    },
    {
      id: "suspension",
      title: "7. Account Suspension",
      icon: <UserMinus className="w-5 h-5" />,
      content: "Accounts can be suspended or permanently terminated for fraud, platform misuse, violation of any policies, or repeated negative feedback from service providers."
    },
    {
      id: "changes",
      title: "8. Changes to Terms",
      icon: <RefreshCw className="w-5 h-5" />,
      content: [
        "We reserve the right to update these terms and conditions at any time without prior specific notice.",
        "Users will be notified of major changes through the platform or via email. Continued use of the platform after changes constitutes acceptance."
      ]
    }
  ];

  const currentDate = formatDate(new Date());

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for sticky navbar
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-20 pb-12 md:pt-32 md:pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4"
          >
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Legal Framework</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-bold text-secondary mb-4"
          >
            Terms & Conditions
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 text-sm md:text-base font-medium"
          >
            Last Updated: {currentDate}
          </motion.p>
        </div>
      </section>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-20 lg:flex lg:gap-12">
        {/* Sticky Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <h3 className="text-sm font-bold text-secondary mb-6 flex items-center gap-2 uppercase tracking-tight">
              Table of Contents
            </h3>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="group flex items-center justify-between w-full text-left px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-primary hover:bg-white rounded-lg transition-all"
                >
                  <span className="truncate">{section.title.split('. ')[1]}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto lg:mx-0 w-full">
          <div className="space-y-10 md:space-y-16">
            {sections.map((section, index) => (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="group scroll-mt-24"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-secondary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    {section.icon}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">
                    {section.title}
                  </h2>
                </div>

                <div className="border-l-2 border-gray-100 ml-5 pl-8 py-2">
                  {Array.isArray(section.content) ? (
                    <ul className="space-y-4">
                      {section.content.map((item, i) => (
                        <li key={i} className="text-gray-600 text-sm md:text-base leading-relaxed flex gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                      {section.content}
                    </p>
                  )}
                </div>

                {index !== sections.length - 1 && (
                  <div className="mt-10 md:mt-16 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
                )}
              </motion.section>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-20 p-8 rounded-2xl bg-primary/5 border border-primary/10 text-center">
            <h4 className="text-secondary font-bold mb-2">Have questions?</h4>
            <p className="text-gray-600 text-sm mb-6">If you have any questions about our Terms & Conditions, please contact our support team.</p>
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Contact Support
            </motion.a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
