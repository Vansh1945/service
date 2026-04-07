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
  Apple
} from 'lucide-react';
import { getSystemSetting } from '../services/SystemService';

const Footer = () => {
  const [systemData, setSystemData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const currentYear = new Date().getFullYear();

  if (loading) return null;

  return (
    <footer className="bg-gray-900 text-gray-300 pt-8 pb-6 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-10">

          {/* Company Info */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2 group">
              {systemData?.logo ? (
                <img src={systemData.logo} alt="Logo" className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-white text-primary" />
                </div>
              )}
              <span className="text-2xl font-bold text-white tracking-tight">
                {systemData?.companyName || "SafeVolt"}
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              {systemData?.tagline || "Professional electrical services at your doorstep. Reliable, certified, and affordable."}
            </p>
            <div className="flex gap-4">
              {[Facebook, Instagram, Linkedin, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="p-2 bg-gray-800 rounded-full hover:bg-primary hover:text-white transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:pl-8">
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-6">Quick Links</h3>
            <ul className="space-y-4">
              {[
                { name: 'Home', path: '/' },
                { name: 'Services', path: '/services' },
                { name: 'About Us', path: '/about' },
                { name: 'Contact', path: '/contact' },
                { name: 'Become a Provider', path: '/register-provider' }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm hover:text-accent transition-colors flex items-center group">
                    <ChevronRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300 text-accent mr-1" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>



          <div>
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-6">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm">
                <MapPin className="w-5 h-5 text-accent shrink-0" />
                <span className="text-gray-400 leading-relaxed">{systemData?.address || "Jalandhar, Punjab"}</span>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Phone className="w-5 h-5 text-accent shrink-0" />
                <a href={`tel:${systemData?.phone}`} className="hover:text-accent transition-colors">{systemData?.phone || "+91 9625333919"}</a>
              </li>
              <li className="flex items-center gap-3 text-sm">
                <Mail className="w-5 h-5 text-accent shrink-0" />
                <a href={`mailto:${systemData?.email}`} className="hover:text-accent transition-colors break-all">{systemData?.email || "info@safevolt.com"}</a>
              </li>
            </ul>
          </div>
          {/* Support & Legal */}
          <div>
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4">Newsletter</h3>
            <form className="relative group">
              <input
                type="email"
                placeholder="Your email"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-primary transition-colors text-white"
              />
              <button className="absolute right-2 top-2 p-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-800">
              <h3 className="text-white font-bold uppercase tracking-wider text-[10px] mb-3">Experience our App</h3>
              <a href="#" className="flex items-center justify-center gap-3 bg-white text-gray-900 py-2.5 px-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-accent/10 group">
                <Smartphone className="w-5 h-5 text-gray-400 group-hover:text-accent transition-colors" />
                <div className="leading-none text-left">
                  <p className="text-[9px] uppercase font-bold text-gray-500">Install our</p>
                  <p className="text-sm font-extrabold tracking-tight">PWA WEB APP</p>
                </div>
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© {currentYear} {systemData?.companyName || "SafeVolt"}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-medium">
            <Link to="/terms" className="hover:text-accent transition-colors uppercase tracking-wider">Terms & Conditions</Link>
            <Link to="/privacy" className="hover:text-accent transition-colors uppercase tracking-wider">Privacy Policy</Link>
            <Link to="/refund" className="hover:text-accent transition-colors uppercase tracking-wider">Refund Policy</Link>
          </div>
          <p>
            Developed by <a href="https://vanshkholi0.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">Vansh</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;