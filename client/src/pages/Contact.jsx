import React, { useState, useEffect } from 'react';
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
  MapPin,
  Star,
  Award,
  ThumbsUp,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth';

const Contact = () => {
  const { API, showToast } = useAuth();
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const contactInfo = {
    primaryPhone: systemData?.phone || '+91 9625333919',
    emergencyPhone: systemData?.phone || '+91 9625333919',
    ctaPhone: systemData?.phone || '+91 9625333919',
    email: systemData?.email || 'info@safevolt.com',
    address: systemData?.address || 'Himachal Pradesh & Punjab, India',
    businessHours: {
      weekdays: '8:00 AM - 6:00 PM',
      sunday: '9:00 AM - 5:00 PM'
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);



  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const response = await fetch(`${API}/system-setting/system-data`);
        const data = await response.json();
        if (data.success) {
          setSystemData(data.data);
        } else {
          setError('Failed to load system data');
        }
      } catch (err) {
        setError('Failed to load system data');
        console.error('Contact fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
  }, [API]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showToast(data.message || 'Thank you for your message! We will get back to you soon.');
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: ''
        });
      } else {
        showToast(data.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      showToast('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Matching other pages */}
      <section className="relative bg-gradient-to-br from-gray-50 to-white pt-20 pb-8 md:pt-28 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-semibold">Contact Us</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight"
            >
              Get in Touch with Our
              <span className="block text-primary mt-1">Electrical Experts</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-600 max-w-2xl mx-auto mb-8"
            >
              Need help with electricity? Our expert team in Himachal Pradesh and Punjab is ready to provide fast, safe, and reliable service for your home.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <a
                href={`tel:${contactInfo.primaryPhone}`}
                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Now
              </a>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                View Services
              </Link>
            </motion.div>
          </div>
        </div>
      </section>



      {/* Contact Form and Info Section */}
      <section className="pt-8 md:pt-12 pb-8 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Send us a Message</h2>
                <p className="text-gray-500">We'll get back to you within 2 hours</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                    placeholder="Enter your email address"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                    placeholder="Enter subject of your message"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows="5"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400 resize-vertical"
                    placeholder="Tell us about your electrical service needs..."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Quick Response</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>Secure & Private</span>
                  </div>
                </div>
              </form>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-center text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Phone Numbers</h3>
                      <p className="text-primary font-medium">{contactInfo.primaryPhone}</p>
                      <p className="text-sm text-gray-500 mt-1">24/7 Emergency Available</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Email Address</h3>
                      <p className="text-gray-600">{contactInfo.email}</p>
                      <p className="text-sm text-gray-500 mt-1">Response within 2 hours</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
                      <p className="text-gray-600">{contactInfo.address}</p>
                      <p className="text-sm text-gray-500 mt-1">Himachal Pradesh & Punjab</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Support timing</h3>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-8">
                          <span className="text-gray-600">Monday - Saturday</span>
                          <span className="font-medium text-gray-900">{contactInfo.businessHours.weekdays}</span>
                        </div>
                        <div className="flex justify-between gap-8">
                          <span className="text-gray-600">Sunday</span>
                          <span className="font-medium text-primary">{contactInfo.businessHours.sunday}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Card */}
              <div className="bg-gradient-to-r from-primary to-teal-600 rounded-xl p-6 md:p-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Emergency Services</h3>
                </div>
                <p className="text-white/90 mb-4 leading-relaxed">
                  Electrical emergencies can happen at any time. Our 24/7 emergency service is currently available in Jalandhar.
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Emergency Hotline</p>
                    <p className="text-xl font-bold">{contactInfo.emergencyPhone}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-lg">
                    <Phone className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section - Matching other pages */}
      <section className="pt-8 md:pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-primary to-teal-600 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Need Expert Help Now?
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Don't worry about electrical problems. Call our experts today for fast and safe service that you can trust.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`tel:${contactInfo.ctaPhone}`}
                className="inline-flex items-center justify-center gap-2 bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call Now: {contactInfo.ctaPhone}
              </a>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
              >
                View Our Services <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;