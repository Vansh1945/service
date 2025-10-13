import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  Clock,
  Zap,
  Send,
  MessageSquare,
  User,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const Contact = () => {
  // Dynamic contact information data
  const contactInfo = {
    primaryPhone: '+91-9625333919',
    emergencyPhone: '+91-9625333919',
    ctaPhone: '+91-9625333919',
    email: 'rajelectricalservice25@gmail.com',
    businessHours: {
      weekdays: '8:00 AM - 6:00 PM',
      sunday: '9:00 AM - 5:00 PM'
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      console.log('Form submitted:', formData);
      setSuccessMessage('Thank you for your message! We will get back to you soon.');
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: ''
      });
    } catch (error) {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center bg-primary/10 px-6 py-3 rounded-full border border-primary/20 mb-6">
              <MessageSquare className="w-5 h-5 text-primary mr-2" />
              <span className="text-primary font-medium">Contact Us</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-poppins text-primary mb-6">
              Get in Touch with Our
              <span className="block text-accent">Electrical Experts</span>
            </h1>
            <p className="text-base sm:text-lg text-secondary/80 max-w-3xl mx-auto leading-relaxed">
              Ready to solve your electrical needs? Our certified professionals across Himachal Pradesh and Punjab
              are here to provide reliable, safe, and efficient electrical solutions for your home or business.
            </p>
          </motion.div>

        </div>
      </section>

      {/* Main Contact Section */}
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10 border border-gray-100 relative overflow-hidden">
                {/* Decorative gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary"></div>

                <div className="relative z-10">
                  <div className="flex items-center mb-4">
                    <div className="bg-primary/10 p-3 rounded-xl mr-4">
                      <Send className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl lg:text-2xl font-bold text-primary">Send us a Message</h2>
                      <p className="text-secondary/70">We'll get back to you within 2 hours</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name Field */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      viewport={{ once: true }}
                    >
                      <label htmlFor="name" className="block text-sm font-semibold text-secondary mb-3 flex items-center">
                        <User className="w-4 h-4 mr-2 text-primary" />
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-secondary placeholder-gray-400"
                        placeholder="Enter your full name"
                      />
                    </motion.div>

                    {/* Email Field */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      viewport={{ once: true }}
                    >
                      <label htmlFor="email" className="block text-sm font-semibold text-secondary mb-3 flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-primary" />
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-secondary placeholder-gray-400"
                        placeholder="Enter your email address"
                      />
                    </motion.div>

                    {/* Phone Field */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      viewport={{ once: true }}
                    >
                      <label htmlFor="phone" className="block text-sm font-semibold text-secondary mb-3 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-primary" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-secondary placeholder-gray-400"
                        placeholder="Enter your phone number"
                      />
                    </motion.div>

                    {/* Message Field */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      viewport={{ once: true }}
                    >
                      <label htmlFor="message" className="block text-sm font-semibold text-secondary mb-3 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2 text-primary" />
                        Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows="5"
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-secondary placeholder-gray-400 resize-vertical"
                        placeholder="Tell us about your electrical service needs, project details, or any questions you have..."
                      ></textarea>
                    </motion.div>

                    {/* Submit Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      viewport={{ once: true }}
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-accent to-accent/90 text-white font-bold py-4 px-8 rounded-xl shadow-lg flex items-center justify-center group disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-3" />
                          Send Message
                          <Zap className="w-5 h-5 ml-3" />
                        </>
                      )}
                    </motion.button>
                  </form>

                  {/* Feedback Messages */}
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-green-100 text-green-800 rounded-xl border border-green-200"
                    >
                      <CheckCircle className="w-5 h-5 inline mr-2" />
                      {successMessage}
                    </motion.div>
                  )}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-100 text-red-800 rounded-xl border border-red-200"
                    >
                      <AlertCircle className="w-5 h-5 inline mr-2" />
                      {errorMessage}
                    </motion.div>
                  )}

                  {/* Trust indicators */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="mt-4 flex items-center justify-center space-x-6 text-sm text-secondary/70"
                  >
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-primary mr-2" />
                      <span>Quick Response</span>
                    </div>
                    <div className="flex items-center">
                      <Shield className="w-4 h-4 text-primary mr-2" />
                      <span>Secure & Private</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Contact Information & Service Areas */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              {/* Contact Details Card */}
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent"></div>

                <div className="flex items-center mb-4">
                  <div className="bg-primary/10 p-3 rounded-xl mr-4">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-primary">Contact Information</h2>
                </div>

                <div className="space-y-4">
                  {/* Phone */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start space-x-4 p-4 rounded-xl bg-primary/5 cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-secondary mb-1">Phone Numbers</h3>
                      <p className="text-primary font-medium">{contactInfo.primaryPhone}</p>
                      <p className="text-accent text-sm font-medium mt-1">24/7 Emergency Available</p>
                    </div>
                  </motion.div>

                  {/* Email */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="flex items-start space-x-4 p-4 rounded-xl bg-accent/5 cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-secondary mb-1">Email Addresses</h3>
                      <p className="text-secondary">{contactInfo.email}</p>
                      <p className="text-accent text-sm font-medium mt-1">Response within 2 hours</p>
                    </div>
                  </motion.div>

                  {/* Business Hours */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    viewport={{ once: true }}
                    className="p-4 rounded-xl bg-primary/5 cursor-pointer"
                  >
                    <div className="flex items-center mb-2">
                      <Clock className="w-5 h-5 text-primary mr-2" />
                      <h3 className="text-lg font-semibold text-secondary">Business Hours</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-secondary font-medium">Monday - Saturday</span>
                        <span className="text-primary font-medium">{contactInfo.businessHours.weekdays}</span>
                      </div>
                      <div className="flex justify-between items-center ">
                        <span className="text-secondary font-medium">Sunday</span>
                        <span className="text-accent font-medium">{contactInfo.businessHours.sunday}</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Emergency Contact Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                viewport={{ once: true }}
                className="bg-gradient-to-r from-accent to-accent/90 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center mb-4">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <h3 className="text-lg lg:text-2xl font-bold">Emergency Services</h3>
                  </div>
                  <p className="text-white/90 mb-4 text-base sm:text-lg leading-relaxed">
                    Electrical emergencies don't wait for business hours. Our certified electricians are available
                    24/7 for urgent electrical issues across Himachal Pradesh and Punjab.
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm">Emergency Hotline</p>
                      <p className="text-lg font-bold">{contactInfo.emergencyPhone}</p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl">
                      <Zap className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-primary to-primary/90">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-base sm:text-lg text-white/90 max-w-3xl mx-auto mb-6 leading-relaxed">
              Don't let electrical issues disrupt your daily life. Contact our expert team today for reliable,
              professional electrical services across Himachal Pradesh and Punjab.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="bg-accent text-white font-bold py-4 px-8 rounded-xl shadow-2xl inline-flex items-center group"
              >
                <Phone className="w-5 h-5 mr-3" />
                Call Now: {contactInfo.ctaPhone}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                className="bg-white/10 backdrop-blur-md text-white font-bold py-4 px-8 border-2 border-white/30 rounded-xl inline-flex items-center"
              >
                <Mail className="w-5 h-5 mr-3" />
                Get Free Quote
              </motion.button>
            </div>

            {/* Trust Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="mt-4 inline-flex items-center bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20"
            >
              <Shield className="w-5 h-5 text-white mr-3" />
              <span className="text-white font-medium">Licensed & Insured Professionals</span>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Contact;