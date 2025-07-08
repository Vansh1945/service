import React from 'react';
import { motion } from 'framer-motion';
import { FaBolt, FaTools, FaHome, FaBuilding, FaPlug, FaLightbulb, FaShieldAlt } from 'react-icons/fa';

const ServicesPage = () => {
    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const services = [
        {
            title: "Ceiling Fan Installation",
            description: "Professional installation of ceiling fans with proper wiring and safety checks. Our certified electricians ensure optimal performance and safety.",
            icon: <FaLightbulb className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1580476262798-bddd9c4a9bb6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Electrical Wiring",
            description: "Complete home or office wiring solutions following modern safety standards. We use premium materials for durable and reliable installations.",
            icon: <FaPlug className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1604320660662-44c1a81e0d7a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Lighting Solutions",
            description: "Custom lighting designs including LED installations and energy-efficient options. Transform your space with our expert lighting designs.",
            icon: <FaLightbulb className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Safety Inspections",
            description: "Comprehensive electrical safety audits for homes and businesses. Identify potential hazards before they become problems.",
            icon: <FaShieldAlt className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1603796846097-bee99e4a601f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Residential Services",
            description: "Complete electrical solutions for homes, apartments, and condominiums. From rewiring to panel upgrades, we handle it all.",
            icon: <FaHome className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
        },
        {
            title: "Commercial Services",
            description: "Reliable electrical systems for offices, retail spaces, and industrial buildings. Minimize downtime with our efficient commercial solutions.",
            icon: <FaBuilding className="text-blue-900 text-xl" />,
            image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
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
        <div className="bg-blue-50 min-h-screen">
            {/* Hero Section */}
            <section className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-20 overflow-hidden">
                <div className="absolute inset-0 opacity-15">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[80px]"></div>
                    <div className="absolute bottom-0 right-0 w-72 h-72 bg-yellow-500 rounded-full filter blur-[90px]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <div className="inline-flex items-center bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-700 mb-6">
                            <FaBolt className="text-yellow-400 mr-2" />
                            <span className="font-medium">Our Services</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                            Professional <span className="text-yellow-400">Electrical Services</span>
                        </h1>
                        <p className="text-xl text-blue-200 max-w-3xl mx-auto">
                            Certified solutions for all your residential and commercial electrical needs
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, index) => (
                        <motion.div
                            key={index}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            className="bg-white rounded-xl shadow-lg overflow-hidden border border-blue-100 transition-all duration-300 hover:shadow-xl relative"
                        >
                            <div className="relative h-56 overflow-hidden">
                                <img
                                    src={service.image}
                                    alt={service.title}
                                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 to-transparent"></div>
                                <div className="absolute top-4 right-4 bg-yellow-400/90 text-blue-900 p-2 rounded-full shadow-md w-10 h-10 flex items-center justify-center ring-2 ring-yellow-200/50">
                                    {service.icon}
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-blue-900 mb-3">{service.title}</h3>
                                <p className="text-gray-600 mb-6">{service.description}</p>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleBookNow(service.title)}
                                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center"
                                >
                                    <FaTools className="mr-2" /> Book Now
                                </motion.button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl sm:text-4xl font-bold mb-6">Need a Custom Electrical Solution?</h2>
                        <p className="text-xl text-blue-200 max-w-3xl mx-auto mb-8">
                            Our certified electricians are ready to handle any electrical challenge with precision and expertise.
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
                        >
                            <FaBolt className="mr-2" /> Get a Free Quote
                        </motion.button>
                    </motion.div>
                </div>
            </section>
            <br/>
        </div>
    );
};

export default ServicesPage;