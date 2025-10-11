import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Zap,
    Clock,
    Star,
    Check,
    ArrowRight,
    Phone,
} from 'lucide-react';

const ServicesPage = () => {
    const navigate = useNavigate();

    // Static services data
    const services = [
        {
            _id: '1',
            title: 'Wiring Installation',
            description: 'Professional wiring installation for new constructions or renovations.',
            price: 'Starting at ₹5,000',
            rating: 4.8,
            features: ['Certified electricians', 'Quality materials', 'Safety guaranteed'],
            image: '/placeholder-service.jpg'
        },
        {
            _id: '2',
            title: 'Electrical Repairs',
            description: 'Quick and reliable repairs for all electrical issues in your home or office.',
            price: 'Starting at ₹1,000',
            rating: 4.7,
            features: ['24/7 emergency service', 'Warranty on repairs', 'Expert technicians'],
            image: '/placeholder-service.jpg'
        },
        {
            _id: '3',
            title: 'Lighting Installation',
            description: 'Install modern lighting solutions to enhance your space.',
            price: 'Starting at ₹2,500',
            rating: 4.9,
            features: ['Energy-efficient options', 'Custom designs', 'Free consultation'],
            image: '/placeholder-service.jpg'
        },
        {
            _id: '4',
            title: 'Panel Upgrades',
            description: 'Upgrade your electrical panel for better safety and efficiency.',
            price: 'Starting at ₹10,000',
            rating: 4.6,
            features: ['Code-compliant upgrades', 'Increased capacity', 'Insurance approved'],
            image: '/placeholder-service.jpg'
        },
        {
            _id: '5',
            title: 'Safety Inspections',
            description: 'Comprehensive electrical safety inspections for peace of mind.',
            price: 'Starting at ₹3,000',
            rating: 4.8,
            features: ['Detailed reports', 'Compliance checks', 'Preventive maintenance'],
            image: '/placeholder-service.jpg'
        },
        {
            _id: '6',
            title: 'Smart Home Setup',
            description: 'Transform your home with smart electrical systems and automation.',
            price: 'Starting at ₹15,000',
            rating: 4.9,
            features: ['Latest technology', 'Remote control', 'Energy monitoring'],
            image: '/placeholder-service.jpg'
        }
    ];

    const handleBookNow = (service) => {
        // Assuming user auth check and navigation logic here
        navigate(`/customer/services/${service._id}`);
    };

    return (
        <div className="min-h-screen bg-background py-16 sm:py-20 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12 sm:mb-16"
                >
                    <div className="inline-flex items-center bg-primary/10 px-6 py-3 rounded-full border border-primary/20 mb-6">
                        <Zap className="w-5 h-5 text-primary mr-2" />
                        <span className="text-primary font-medium">Our Services</span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-6">
                        Professional <span className="text-accent">Electrical Solutions</span>
                    </h2>
                    <p className="text-lg text-secondary/80 max-w-3xl mx-auto">
                        Comprehensive electrical services tailored to meet your specific needs with quality,
                        reliability, and competitive pricing
                    </p>
                </motion.div>

                {/* Services Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, index) => (
                        <motion.div
                            key={service._id || index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-300 group hover:shadow-xl hover:border-accent/20"
                        >
                            {/* Service Image */}
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={service.image}
                                    alt={service.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    loading="lazy"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = '/placeholder-service.jpg';
                                }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                                {/* Price Badge */}
                                <div className="absolute top-4 left-4 bg-accent text-background px-3 py-2 rounded-full font-bold text-sm shadow-lg">
                                    {service.price}
                                </div>

                                {/* Rating */}
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full flex items-center shadow-lg">
                                    <Star className="text-yellow-400 w-4 h-4 mr-1 fill-current" />
                                    <span className="font-bold text-sm">{service.rating.toFixed(1)}</span>
                                </div>
                            </div>

                            {/* Service Content */}
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-primary mb-3 group-hover:text-accent transition-colors duration-300">
                                    {service.title}
                                </h3>
                                <p className="text-secondary/70 mb-4 leading-relaxed">{service.description}</p>

                                {/* Features */}
                                <div className="mb-6">
                                    <ul className="space-y-2">
                                        {service.features && service.features.length > 0 ? (
                                            service.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-center text-sm text-secondary/70">
                                                    <Check className="text-accent w-4 h-4 mr-2" />
                                                    {feature}
                                                </li>
                                            ))
                                        ) : null}
                                    </ul>
                                </div>

                                {/* Book Button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleBookNow(service)}
                                    className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-accent hover:to-accent/90 text-background font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl group"
                                >
                                    <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                                    Book This Service
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </motion.button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Call to Action Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-center mt-16 sm:mt-20"
                >
                    <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-8 sm:p-12 border border-primary/20">
                        <h3 className="text-2xl sm:text-3xl font-bold text-primary mb-4">
                            Can't Find What You're Looking For?
                        </h3>
                        <p className="text-secondary/80 mb-6 max-w-2xl mx-auto">
                            Contact us directly for custom electrical solutions and specialized services tailored to your unique requirements.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-primary text-background px-8 py-3 rounded-xl font-semibold flex items-center justify-center hover:bg-primary/90 transition-colors"
                            >
                                <Phone className="w-5 h-5 mr-2" />
                                Call Now
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="border-2 border-primary text-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary hover:text-background transition-colors"
                            >
                                Get Free Consultation
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ServicesPage;