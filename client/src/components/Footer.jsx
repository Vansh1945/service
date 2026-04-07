import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Smartphone,
  ShieldCheck,
  Zap,
  Heart,
  Send,
  Apple,
  Youtube
} from 'lucide-react';
import { getSystemSetting } from '../services/SystemService';

const Footer = () => {
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  useEffect(() => {
    const handleBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBIP);
    return () => window.removeEventListener('beforeinstallprompt', handleBIP);
  }, []);

  const handleInstallClick = async (e) => {
    e.preventDefault();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const response = await getSystemSetting();
        if (response.data.success) {
          setSystemData(response.data.data);
        }
      } catch (err) {
        console.error('Footer fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSystemData();
  }, []);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setNewsletterStatus('success');
      setEmail('');
      setTimeout(() => setNewsletterStatus(null), 3000);
    }
  };

  const currentYear = new Date().getFullYear();

  if (loading) return null;

  const getSocialIcon = (platform) => {
    const icons = {
      facebook: Facebook,
      twitter: Twitter,
      instagram: Instagram,
      linkedin: Linkedin,
      youtube: Youtube,
    };
    return icons[platform.toLowerCase()];
  };

  const socialLinks = systemData?.socialLinks ? Object.entries(systemData.socialLinks)
    .filter(([_, href]) => href && href !== '#' && href !== '')
    .map(([platform, href]) => ({
      Icon: getSocialIcon(platform),
      href,
      platform
    }))
    .filter(social => social.Icon) : [];

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
    { name: 'Become a Provider', path: '/register-provider' }
  ];

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

          {/* Company Info Section */}
          <div className="space-y-5">
            <Link to="/" className="flex items-center gap-3 group w-fit">
              {systemData?.logo ? (
                <img src={systemData.logo} alt="Logo" className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {systemData?.companyName || "SafeVolt"}
              </span>
            </Link>

            <p className="text-sm leading-relaxed text-gray-400">
              {systemData?.tagline || "Professional electrical services at your doorstep. Reliable, certified, and affordable solutions for all your electrical needs."}
            </p>

            {/* Social Icons */}
            <div className="flex gap-3 pt-2">
              {socialLinks.map(({ Icon, href, platform }, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-gray-800 rounded-lg text-gray-400 hover:bg-primary hover:scale-110 transition-all duration-300 shadow-md group"
                  aria-label={`Follow us on ${platform}`}
                >
                  <Icon className="w-4 h-4 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links Section */}
          <div>
            <h3 className="text-white font-semibold text-base mb-5 tracking-wide">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-sm text-gray-400 hover:text-primary transition-all duration-300 flex items-center group"
                  >
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 text-primary mr-1" />
                    <span className="group-hover:translate-x-1 transition-transform duration-300">{link.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info Section */}
          <div>
            <h3 className="text-white font-semibold text-base mb-5 tracking-wide">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm group">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-gray-400 leading-relaxed">{systemData?.address || "Jalandhar, Punjab, India"}</span>
              </li>
              <li className="flex items-center gap-3 text-sm group">
                <Phone className="w-5 h-5 text-primary shrink-0 group-hover:scale-110 transition-transform duration-300" />
                <a href={`tel:${systemData?.phone}`} className="text-gray-400 hover:text-primary transition-colors duration-300">
                  {systemData?.phone || "+91 9625333919"}
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm group">
                <Mail className="w-5 h-5 text-primary shrink-0 group-hover:scale-110 transition-transform duration-300" />
                <a href={`mailto:${systemData?.email}`} className="text-gray-400 hover:text-primary transition-colors duration-300 break-all">
                  {systemData?.email || "info@safevolt.com"}
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter & App Section */}
          <div className="space-y-6">
            {/* Newsletter */}
            <div>
              <h3 className="text-white font-semibold text-base mb-4 tracking-wide">Newsletter</h3>
              <form onSubmit={handleNewsletterSubmit} className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 p-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-all duration-300 hover:scale-105"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              {newsletterStatus === 'success' && (
                <p className="text-xs text-green-400 mt-2 animate-pulse">Subscribed successfully!</p>
              )}
            </div>

            {/* App Download */}
            <div className="pt-2">
              <h3 className="text-white font-semibold text-base mb-4 tracking-wide">Download Our App</h3>

              {/* Web App (PWA) Button */}
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl py-3 px-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group mt-1"
              >
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Launch Web App</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            {/* Copyright */}
            <p className="text-center md:text-left">
              © {currentYear} {systemData?.companyName || "SafeVolt"}. All rights reserved.
            </p>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/terms" className="hover:text-primary transition-colors duration-300 hover:underline underline-offset-4">
                Terms & Conditions
              </Link>
              <Link to="/privacy" className="hover:text-primary transition-colors duration-300 hover:underline underline-offset-4">
                Privacy Policy
              </Link>
              <Link to="/refund" className="hover:text-primary transition-colors duration-300 hover:underline underline-offset-4">
                Refund Policy
              </Link>
              <Link to="/sitemap" className="hover:text-primary transition-colors duration-300 hover:underline underline-offset-4">
                Sitemap
              </Link>
            </div>

            {/* Developer Credit */}
            <p className="text-center md:text-right flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-primary fill-primary" /> by
              <a
                href="https://vanshkholi0.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 font-semibold transition-colors duration-300 hover:underline underline-offset-4"
              >
                Vansh
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;