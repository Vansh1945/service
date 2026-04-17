import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  RefreshCcw, 
  XCircle, 
  Clock, 
  CreditCard, 
  AlertCircle, 
  Mail, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

const RefundPolicy = () => {
  useEffect(() => {
    document.title = "Refund Policy | SAFEVOLT SOLUTIONS";
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      title: "Refund Eligibility",
      icon: <CheckCircle2 className="w-6 h-6 text-primary" />,
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
      icon: <XCircle className="w-6 h-6 text-red-500" />,
      description: "Refund will NOT be provided if:",
      items: [
        "Service has been successfully completed",
        "Cancellation is done at the last moment"
      ],
      bgColor: "bg-red-50"
    },
    {
      title: "Refund Time",
      icon: <Clock className="w-6 h-6 text-accent" />,
      description: "Refunds will be processed within 5–7 working days after approval.",
      bgColor: "bg-accent/5"
    },
    {
      title: "Payment Method Refund",
      icon: <CreditCard className="w-6 h-6 text-blue-500" />,
      description: "Refund will be credited to the original payment method used during booking.",
      bgColor: "bg-blue-50"
    },
    {
      title: "Cancellation Charges",
      icon: <AlertCircle className="w-6 h-6 text-orange-500" />,
      description: "Important notes on cancellations:",
      items: [
        "Last-minute cancellations may incur partial charges",
        "Applicable fees will be deducted before processing refund"
      ],
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Header Section */}
      <section className="bg-gray-50 border-b border-gray-100 pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
          >
            <RefreshCcw className="w-4 h-4 text-primary" />
            <span className="text-primary text-sm font-semibold uppercase tracking-wider">Refund Center</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-extrabold text-secondary mb-6 tracking-tight"
          >
            Refund Policy
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Understand our refund and cancellation terms clearly to ensure a smooth experience with our services.
          </motion.p>
        </div>
      </section>

      {/* Policy Sections Grid */}
      <main className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`group p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${section.bgColor}`}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {section.icon}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-secondary">
                  {section.title}
                </h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700 font-medium leading-relaxed">
                  {section.description}
                </p>
                {section.items && (
                  <ul className="space-y-3">
                    {section.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-gray-600 group/item">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 group-hover/item:bg-primary transition-colors shrink-0" />
                        <span className="text-sm md:text-base leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          ))}

          {/* Guarantee Highlight Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="md:col-span-2 bg-gradient-to-br from-secondary to-gray-800 p-8 md:p-12 rounded-3xl text-white shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck className="w-48 h-48 -mr-12 -mt-12" />
            </div>
            <div className="relative z-10 max-w-3xl">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">Our Commitment to Satisfaction</h3>
              <p className="text-gray-300 text-lg leading-relaxed mb-0">
                At SAFEVOLT SOLUTIONS, we value your trust. If you're not satisfied with a service, our support team will work tirelessly to resolve the issue or process your refund as per our transparent guidelines.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA Section */}
        <section className="mt-20 md:mt-32">
          <div className="max-w-4xl mx-auto bg-primary/5 rounded-3xl p-8 md:p-16 text-center border border-primary/10 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-extrabold text-secondary mb-4">
                Still have questions?
              </h2>
              <p className="text-gray-600 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
                If you encounter any issues with a booking or have specific queries about a refund, we're here to help you 24/7.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-3 bg-primary text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Mail className="w-5 h-5" />
                  Contact Support
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Scroll to Top Note */}
      <div className="pb-12 text-center text-gray-400 text-xs uppercase tracking-[0.2em] font-bold">
        SafeVolt Solutions • Fairness • Transparency • Trust
      </div>
    </div>
  );
};

export default RefundPolicy;
