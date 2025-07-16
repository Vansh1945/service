import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Star, Clock, IndianRupee, 
  Zap, Droplet, Wrench, Settings, ChevronRight, 
  Sparkles, Heart, Shield, Award, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ServicesPage = () => {
    const [services, setServices] = useState([]);
    const [filteredServices, setFilteredServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('popular');
    const [categories, setCategories] = useState([]);
    const navigate = useNavigate();

    const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

    // Icon mapping for categories
    const categoryIcons = {
        'Electrical': <Zap className="w-5 h-5 text-yellow-500" />,
        'AC': <Droplet className="w-5 h-5 text-blue-400" />,
        'Appliance Repair': <Wrench className="w-5 h-5 text-gray-600" />,
        'Other': <Settings className="w-5 h-5 text-purple-500" />
    };

    // Fetch services and categories
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Fetch services
                const servicesResponse = await fetch(`${API}/service/services`);
                const servicesData = await servicesResponse.json();
                
                if (servicesData.success) {
                    setServices(servicesData.data);
                    setFilteredServices(servicesData.data);
                    
                    // Extract unique categories
                    const uniqueCategories = ['All', ...new Set(
                        servicesData.data.map(service => service.category)
                    )];
                    setCategories(uniqueCategories);
                } else {
                    setError(servicesData.message || 'Failed to fetch services');
                }
            } catch (err) {
                setError('Network error. Please try again later.');
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [API]);

    // Filter and search services
    useEffect(() => {
        let filtered = [...services];

        // Category filter
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(service => service.category === selectedCategory);
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(service =>
                service.title.toLowerCase().includes(term) ||
                service.description.toLowerCase().includes(term) ||
                service.category.toLowerCase().includes(term)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price-low':
                    return a.basePrice - b.basePrice;
                case 'price-high':
                    return b.basePrice - a.basePrice;
                case 'name':
                    return a.title.localeCompare(b.title);
                default: // popular
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        setFilteredServices(filtered);
    }, [services, searchTerm, selectedCategory, sortBy]);

    const handleBookNow = (serviceId) => {
        navigate(`/customer/services/${serviceId}`);
    };

    const ServiceCard = ({ service }) => (
        <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group relative">
            <div className="relative overflow-hidden h-48">
                <img
                    src={service.image ? `${API}/service/uploads/services/${service.image}` : '/placeholder-service.jpg'}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                        e.target.src = '/placeholder-service.jpg';
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <button className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-sm hover:shadow-md">
                    <Heart className="w-4 h-4 text-rose-500 hover:fill-rose-500" />
                </button>
            </div>

            <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                    {categoryIcons[service.category] || categoryIcons['Other']}
                    <span className="text-sm font-medium text-gray-500">{service.category}</span>
                </div>
                
                <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {service.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {service.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-full">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-blue-600 font-medium">{service.durationFormatted || '30 mins'}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-end gap-1">
                        <IndianRupee className="w-5 h-5 text-gray-600" />
                        <span className="text-xl font-bold text-gray-800">
                            {service.basePrice}
                        </span>
                    </div>
                    <button
                        onClick={() => handleBookNow(service._id)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Book Now
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="mt-4 text-gray-600 font-medium">Loading services...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Service Unavailable</h3>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-[url('https://tailwindui.com/img/beams-pricing.png')] bg-[length:800px] bg-top"></div>
                </div>
                
                <div className="relative max-w-7xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Professional Home Services</h1>
                    <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-blue-100">
                        Quality services delivered with guaranteed satisfaction
                    </p>
                    
                    <div className="max-w-2xl mx-auto relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-blue-300" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search for services (e.g. 'AC repair', 'Electrician')..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-4 border border-transparent rounded-lg bg-blue-500/20 backdrop-blur-sm placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Category Filters */}
                <div className="mb-8">
                    <h2 className="sr-only">Categories</h2>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200 ${
                                    selectedCategory === category 
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm'
                                }`}
                            >
                                {categoryIcons[category] || categoryIcons['Other']}
                                <span>{category}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                            {selectedCategory === 'All' ? 'All Services' : selectedCategory}
                        </h2>
                        <p className="text-gray-500">{filteredServices.length} services available</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
                            >
                                <option value="popular">Most Recent</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name">Alphabetical</option>
                            </select>
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                <Filter className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Services Grid */}
                {filteredServices.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                        <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-800 mb-2">No services found</h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">We couldn't find any services matching your criteria. Try adjusting your search or filters.</p>
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('All');
                                setSortBy('popular');
                            }}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                        >
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredServices.map((service) => (
                            <ServiceCard key={service._id} service={service} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServicesPage;