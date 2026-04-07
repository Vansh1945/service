import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Zap,
    Clock,
    Star,
    ArrowRight,
    Phone,
    Shield,
    Award,
    MapPin,
    Heart,
    ThumbsUp,
    CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Wiring from '../assets/Service1.png';

const ServicesPage = () => {
    const navigate = useNavigate();

    const phoneNumber = '+91 9625333919';
    const consultationLink = '/contact';

    const services = [
        {
            _id: '1',
            title: 'House Wiring',
            description: 'Professional wiring installation for new constructions or renovations. Complete home electrical setup with safety certifications.',
            price: '₹5,000+',
            rating: 4.8,
            features: ['Certified electricians', 'Quality materials', 'Safety guaranteed'],
            image: Wiring
        },
        {
            _id: '2',
            title: 'Expert Repairs',
            description: 'Quick and reliable repairs for all electrical issues in your home. 24/7 emergency service available.',
            price: '₹1,000+',
            rating: 4.7,
            features: ['24/7 emergency service', 'Warranty on repairs', 'Expert technicians'],
            image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&q=80&w=800'
        },
        {
            _id: '3',
            title: 'Luxe Lighting',
            description: 'Install modern lighting solutions to enhance your workspace. Energy-efficient options with custom designs.',
            price: '₹2,500+',
            rating: 4.9,
            features: ['Energy-efficient options', 'Custom designs', 'Free consultation'],
            image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=800'
        },
        {
            _id: '4',
            title: 'Panel Upgrades',
            description: 'Upgrade your electrical panel for better safety and efficiency. Code-compliant upgrades for increased capacity.',
            price: '₹10,000+',
            rating: 4.6,
            features: ['Code-compliant upgrades', 'Increased capacity', 'Insurance approved'],
            image: 'https://images.unsplash.com/photo-1565608444338-31650f907693?auto=format&fit=crop&q=80&w=800'
        },
        {
            _id: '5',
            title: 'Safety Audits',
            description: 'Comprehensive electrical safety inspections for total peace of mind. Detailed reports with compliance checks.',
            price: '₹3,000+',
            rating: 4.8,
            features: ['Detailed reports', 'Compliance checks', 'Preventive maintenance'],
            image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=800'
        },
        {
            _id: '6',
            title: 'Smart Systems',
            description: 'Transform your home with smart electrical systems and automation. Latest technology with remote control features.',
            price: '₹15,000+',
            rating: 4.9,
            features: ['Latest technology', 'Remote control', 'Energy monitoring'],
            image: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=800'
        }
    ];

    const handleBookNow = (service) => {
        navigate(`/customer/services`);
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section - Matching AboutPage style */}
            <section className="relative bg-gradient-to-br from-gray-50 to-white pt-20 pb-8 md:pt-28 md:pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6"
                        >
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="text-primary text-sm font-semibold">Our Services</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight"
                        >
                            Professional Electrical
                            <span className="block text-primary mt-2">Services for Every Need</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-gray-600 max-w-2xl mx-auto mb-8"
                        >
                            From complete house wiring to smart home automation, we deliver quality workmanship with safety as our top priority
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-4 justify-center"
                        >
                            <Link
                                to="/contact"
                                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Get Free Quote <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                to="/about"
                                className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Learn About Us
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Services Grid Section */}
            <section className="pt-8 md:pt-12 pb-8 md:pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            What We Offer
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Comprehensive electrical solutions tailored to your specific needs
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {services.map((service, index) => (
                            <motion.div
                                key={service._id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300"
                            >
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={service.image}
                                        alt={service.title}
                                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                    />
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                        <span className="text-sm font-semibold text-gray-900">{service.rating}</span>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-xl font-bold text-gray-900">{service.title}</h3>
                                        <span className="text-primary font-bold">{service.price}</span>
                                    </div>
                                    <p className="text-gray-500 text-sm mb-4 leading-relaxed">{service.description}</p>

                                    <div className="space-y-2 mb-6">
                                        {service.features.map((feature, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                <span className="text-sm text-gray-600">{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handleBookNow(service)}
                                        className="w-full bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Book Now <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section - Matching AboutPage features section */}
            <section className="py-10 md:py-16 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Why Choose Us
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            We offer the best service with experts you can trust
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Shield, title: "Trusted Experts", description: "Trained professionals who handle every job with safety and care." },
                            { icon: Clock, title: "On-Time Service", description: "We arrive on time and finish the work quickly on the same day." },
                            { icon: ThumbsUp, title: "Clear Pricing", description: "Simple and honest pricing with no extra or hidden costs." },
                            { icon: Heart, title: "Top Rated", description: "Thousands of happy customers trust us for our great service." },
                        ].map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                    <p className="text-sm text-gray-500">{feature.description}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA Section - Matching AboutPage style */}
            <section className="pt-8 md:pt-10 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-gradient-to-r from-primary to-teal-600 rounded-2xl p-8 md:p-12 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Need Professional Electrical Service?
                        </h2>
                        <p className="text-white/90 mb-6 max-w-2xl mx-auto">
                            Get a free quote today. Quick response, transparent pricing, and quality guaranteed.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to={`tel:${phoneNumber}`}
                                className="inline-flex items-center justify-center gap-2 bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                            >
                                <Phone className="w-4 h-4" />
                                Call Now
                            </Link>
                            <Link
                                to={consultationLink}
                                className="inline-flex items-center justify-center gap-2 bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
                            >
                                Get Free Consultation
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ServicesPage;