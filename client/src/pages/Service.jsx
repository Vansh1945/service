import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
    Zap, 
    MapPin, 
    Award, 
    Shield, 
    Phone,
    Mountain,
    Home as HomeIcon,
    Clock,
    Users,
    ThumbsUp,
    Star,
    Check,
    ArrowRight,
    Quote
} from 'lucide-react';
import ServiceImg from '../assets/ServiceImg.png';

const ServicesPage = () => {
    const services = [
        {
            title: "Ceiling Fan Installation",
            description: "Professional installation of ceiling fans with proper wiring and safety checks. Our certified electricians ensure optimal performance and safety.",
            price: "Starting at ₹1,500",
            rating: 4.9,
            features: ["Safety Certified", "1 Year Warranty", "Same Day Service"],
            image: "https://images.unsplash.com/photo-1580476262798-bddd9c4a9bb6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Electrical Wiring",
            description: "Complete home or office wiring solutions following modern safety standards. We use premium materials for durable and reliable installations.",
            price: "Starting at ₹5,000",
            rating: 4.8,
            features: ["ISI Certified Wire", "10 Year Warranty", "Free Inspection"],
            image: "https://images.unsplash.com/photo-1604320660662-44c1a81e0d7a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "LED Lighting Solutions",
            description: "Custom lighting designs including LED installations and energy-efficient options. Transform your space with our expert lighting designs.",
            price: "Starting at ₹2,000",
            rating: 4.9,
            features: ["Energy Efficient", "5 Year Warranty", "Custom Design"],
            image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Safety Inspections",
            description: "Comprehensive electrical safety audits for homes and businesses. Identify potential hazards before they become problems.",
            price: "Starting at ₹1,000",
            rating: 5.0,
            features: ["Certified Inspector", "Detailed Report", "Safety Certificate"],
            image: "https://images.unsplash.com/photo-1603796846097-bee99e4a601f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Residential Services",
            description: "Complete electrical solutions for homes, apartments, and condominiums. From rewiring to panel upgrades, we handle it all.",
            price: "Starting at ₹3,000",
            rating: 4.8,
            features: ["24/7 Support", "Licensed Electricians", "Quality Materials"],
            image: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Commercial Services",
            description: "Reliable electrical systems for offices, retail spaces, and industrial buildings. Minimize downtime with our efficient commercial solutions.",
            price: "Custom Quote",
            rating: 4.9,
            features: ["Industrial Grade", "Minimal Downtime", "Bulk Pricing"],
            image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        }
    ];

    const stats = [
        { number: "5000+", label: "Happy Customers", icon: <Users className="w-5 h-5" /> },
        { number: "15+", label: "Years Experience", icon: <Award className="w-5 h-5" /> },
        { number: "24/7", label: "Emergency Service", icon: <Clock className="w-5 h-5" /> },
        { number: "99%", label: "Satisfaction Rate", icon: <ThumbsUp className="w-5 h-5" /> }
    ];

    const testimonials = [
        {
            name: "Rajesh Kumar",
            location: "Shimla, HP",
            rating: 5,
            comment: "Excellent service! They rewired my entire house professionally and on time. Highly recommended for electrical work.",
            service: "Complete House Wiring"
        },
        {
            name: "Priya Sharma",
            location: "Chandigarh, Punjab",
            rating: 5,
            comment: "Quick response for emergency repair. The electrician was knowledgeable and fixed the issue efficiently.",
            service: "Emergency Repair"
        },
        {
            name: "Amit Singh",
            location: "Dharamshala, HP",
            rating: 4,
            comment: "Professional LED installation service. Great quality work and reasonable pricing. Will use again.",
            service: "LED Installation"
        }
    ];

    const processSteps = [
        {
            step: "1",
            title: "Book Service",
            description: "Choose your service and book online or call us directly",
            icon: <Phone className="w-5 h-5" />
        },
        {
            step: "2",
            title: "Schedule Visit",
            description: "We'll schedule a convenient time for inspection and quote",
            icon: <Clock className="w-5 h-5" />
        },
        {
            step: "3",
            title: "Expert Work",
            description: "Our certified electricians complete the work safely",
            icon: <Zap className="w-5 h-5" />
        },
        {
            step: "4",
            title: "Quality Check",
            description: "Final inspection and testing to ensure everything works perfectly",
            icon: <Check className="w-5 h-5" />
        }
    ];

    const handleBookNow = (service) => {
        const isLoggedIn = false; // Replace with actual auth check
        if (!isLoggedIn) {
            window.location.href = '/login';
        } else {
            console.log(`Booking ${service}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <section className="relative mt-20 min-h-[80vh] flex items-center justify-center overflow-hidden bg-gray-100">
                {/* Background Image */}
                <div className="absolute inset-0">
                    <img 
                        src={ServiceImg} 
                        alt="Electrical Services" 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-primary/70 to-background/80"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                            className="inline-flex items-center bg-background/15 backdrop-blur-md px-6 py-3 rounded-full border border-background/30 mb-8"
                        >
                            <Zap className="text-accent w-5 h-5 mr-2" />
                            <span className="font-semibold text-background text-lg">Professional Electrical Services</span>
                        </motion.div>

                        {/* Title */}
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-background leading-tight">
                            Expert <span className="text-accent">Electrical</span>
                            <br />
                            Solutions
                        </h1>

                        <p className="text-lg sm:text-xl text-background/90 max-w-3xl mx-auto mb-8 leading-relaxed">
                            Certified electricians providing reliable, safe, and efficient electrical services 
                            for homes and businesses across Himachal Pradesh & Punjab
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-accent hover:bg-accent/90 text-background font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center group"
                            >
                                <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                                Book Service Now
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </motion.button>
                            
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-background/10 hover:bg-background/20 backdrop-blur-md text-background font-semibold py-4 px-8 border-2 border-background/30 hover:border-background/50 rounded-xl transition-all duration-300 flex items-center"
                            >
                                <Phone className="w-5 h-5 mr-2" />
                                Get Free Quote
                            </motion.button>
                        </div>

                        {/* Trust Indicators */}
                        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                            {stats.map((stat, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + index * 0.1 }}
                                    className="bg-background/10 backdrop-blur-md rounded-xl p-4 border border-background/20 text-center"
                                >
                                    <div className="text-accent mb-2 flex justify-center">
                                        {stat.icon}
                                    </div>
                                    <div className="text-xl font-bold text-background mb-1">{stat.number}</div>
                                    <div className="text-background/80 text-sm">{stat.label}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Services Section */}
            <section className="py-16 sm:py-20 lg:py-24">
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
                                key={index}
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
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                                    
                                    {/* Price Badge */}
                                    <div className="absolute top-4 left-4 bg-accent text-background px-3 py-2 rounded-full font-bold text-sm shadow-lg">
                                        {service.price}
                                    </div>
                                    
                                    {/* Rating */}
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full flex items-center shadow-lg">
                                        <Star className="text-yellow-400 w-4 h-4 mr-1 fill-current" />
                                        <span className="font-bold text-sm">{service.rating}</span>
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
                                            {service.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-center text-sm text-secondary/70">
                                                    <Check className="text-accent w-4 h-4 mr-2" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Book Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleBookNow(service.title)}
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
            </section>

            {/* How It Works Section */}
            <section className="py-16 sm:py-20 lg:py-24 bg-primary/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12 sm:mb-16"
                    >
                        <div className="inline-flex items-center bg-primary/10 px-6 py-3 rounded-full border border-primary/20 mb-6">
                            <Clock className="w-5 h-5 text-primary mr-2" />
                            <span className="text-primary font-medium">Our Process</span>
                        </div>
                        
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-6">
                            How It <span className="text-accent">Works</span>
                        </h2>
                        <p className="text-lg text-secondary/80 max-w-3xl mx-auto">
                            Simple steps to get your electrical work done professionally and efficiently
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {processSteps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="text-center relative"
                            >
                                {/* Step Number */}
                                <div className="relative mb-6">
                                    <div className="w-16 h-16 bg-gradient-to-r from-primary to-primary/90 rounded-full flex items-center justify-center mx-auto shadow-lg">
                                        <span className="text-lg font-bold text-background">{step.step}</span>
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-accent rounded-full flex items-center justify-center text-background shadow-lg">
                                        {step.icon}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-primary mb-3">{step.title}</h3>
                                <p className="text-secondary/70 text-sm leading-relaxed">{step.description}</p>

                                {/* Connector Line */}
                                {index < processSteps.length - 1 && (
                                    <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent transform -translate-y-1/2"></div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-16 sm:py-20 lg:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12 sm:mb-16"
                    >
                        <div className="inline-flex items-center bg-primary/10 px-6 py-3 rounded-full border border-primary/20 mb-6">
                            <Quote className="w-5 h-5 text-primary mr-2" />
                            <span className="text-primary font-medium">Testimonials</span>
                        </div>
                        
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-6">
                            What Our <span className="text-accent">Customers Say</span>
                        </h2>
                        <p className="text-lg text-secondary/80 max-w-3xl mx-auto">
                            Real feedback from satisfied customers across Himachal Pradesh and Punjab
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 relative"
                            >
                                <Quote className="text-primary text-2xl mb-4 opacity-50" />
                                
                                <div className="flex items-center mb-4">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} className="text-yellow-400 w-4 h-4 mr-1 fill-current" />
                                    ))}
                                </div>

                                <p className="text-secondary/80 mb-6 leading-relaxed italic">
                                    "{testimonial.comment}"
                                </p>

                                <div className="border-t border-gray-200 pt-4">
                                    <div className="font-bold text-primary">{testimonial.name}</div>
                                    <div className="text-sm text-secondary/60 mb-1">{testimonial.location}</div>
                                    <div className="text-sm text-accent font-medium">{testimonial.service}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-primary via-primary/90 to-primary text-background">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                            Ready to Get Started?
                        </h2>
                        <p className="text-lg text-background/90 max-w-3xl mx-auto mb-8 leading-relaxed">
                            Join thousands of satisfied customers who trust us with their electrical needs. 
                            Get a free quote today and experience the difference of professional service.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-accent hover:bg-accent/90 text-background font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center group"
                            >
                                <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                                Get Free Quote Now
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </motion.button>
                            
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-background/10 hover:bg-background/20 backdrop-blur-md text-background font-semibold py-4 px-8 border-2 border-background/30 hover:border-background/50 rounded-xl transition-all duration-300 flex items-center"
                            >
                                <Phone className="w-5 h-5 mr-2" />
                                Call: +91-XXXXX-XXXXX
                            </motion.button>
                        </div>

                        {/* Emergency Notice */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-8 bg-background/10 backdrop-blur-md rounded-xl p-4 border border-background/20 inline-block"
                        >
                            <div className="flex items-center justify-center text-accent mb-1">
                                <Clock className="w-4 h-4 mr-2" />
                                <span className="font-semibold">24/7 Emergency Service Available</span>
                            </div>
                            <p className="text-background/80 text-sm">
                                Electrical emergencies don't wait - neither do we!
                            </p>
                        </motion.div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default ServicesPage;