import React, { useState, useEffect } from 'react';
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
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchServices = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/service/services');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to fetch services');
                }

                if (data.success && data.data) {
                    // Transform data to match UI expectations
                    const transformed = data.data.map(service => ({
                        ...service,
                        price: service.basePrice ? `Starting at ₹${service.basePrice.toLocaleString()}` : 'Price on request',
                        rating: service.averageRating || 0,
                        features: service.specialNotes || [],
                        image: service.images && service.images.length > 0 ? service.images[0] : 'https://via.placeholder.com/400x300?text=No+Image'
                    }));
                    setServices(transformed);
                } else {
                    setServices([]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, []);

    const handleBookNow = (service) => {
        // Assuming user auth check and navigation logic here
        navigate(`/customer/services/${service._id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading services...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-red-600">
                <p>Error loading services: {error}</p>
            </div>
        );
    }

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, index) => (
                        <motion.div
                            key={service._id || index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            whileHover={{ y: -8, transition: { duration: 0.3 } }}
                            className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 group"
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
                                        e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
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
            </div>
        </div>
    );
};

export default ServicesPage;
