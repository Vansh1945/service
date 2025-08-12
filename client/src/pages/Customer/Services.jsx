import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Star, Clock, IndianRupee,
    ChevronRight, Heart, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../store/auth';
import ServiceImg from '../../assets/ServiceImg.png';

const ServiceListingPage = () => {
    const { API } = useAuth();
    const navigate = useNavigate();

    const [services, setServices] = useState([]);
    const [filteredServices, setFilteredServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState('popular');
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch services
    const fetchServices = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API}/service/services`);
            const data = await response.json();

            if (data.success) {
                setServices(data.data);
                setFilteredServices(data.data);

                // Extract unique categories
                const uniqueCategories = ['All', ...new Set(
                    data.data.map(service => service.category)
                )];
                setCategories(uniqueCategories);
            } else {
                toast.error(data.message || 'Failed to fetch services');
            }
        } catch (error) {
            toast.error('Network error. Please try again later.');
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch services by category
    const fetchServicesByCategory = async (category) => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API}/service/services/category/${category}`);
            const data = await response.json();

            if (data.success) {
                setFilteredServices(data.data);
            } else {
                toast.error(data.message || 'Failed to fetch services');
            }
        } catch (error) {
            toast.error('Network error. Please try again later.');
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    // Handle category change
    useEffect(() => {
        if (selectedCategory !== 'All') {
            fetchServicesByCategory(selectedCategory);
        } else {
            setFilteredServices(services);
        }
    }, [selectedCategory]);

    // Filter and sort services
    useEffect(() => {
        let results = [...filteredServices];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            results = results.filter(service =>
                service.title.toLowerCase().includes(term) ||
                service.description.toLowerCase().includes(term)
            );
        }

        // Apply sorting
        results.sort((a, b) => {
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

        setFilteredServices(results);
    }, [searchTerm, sortBy]);

    const handleBookNow = (serviceId) => {
        navigate(`/customer/services/${serviceId}`);
    };

    const ServiceCard = ({ service }) => (
        <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group relative">
            <div className="relative overflow-hidden h-48">
                <img
                    src={
                        service.image
                            ? `${API}/uploads/serviceImages/${service.image}`
                            : ServiceImg
                    }
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                        e.target.onerror = null; // prevent infinite loop
                        e.target.src = ServiceImg;
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                <button
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-sm hover:shadow-md"
                    onClick={(e) => {
                        e.stopPropagation();
                        toast.info('Feature coming soon!');
                    }}
                >
                    <Heart className="w-4 h-4 text-rose-500 hover:fill-rose-500" />
                </button>
            </div>

            <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-600">{service.category}</span>
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
                        <span className="text-xs text-blue-600 font-medium">
                            {service.durationFormatted || '30 mins'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium text-gray-700">4.8</span>
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
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
                    >
                        Book Now
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-blue-50">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-10 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-top"></div>
                </div>

                <div className="relative max-w-7xl mx-auto text-center">


                    <div className="max-w-2xl mx-auto relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-blue-300" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search for services (e.g. 'AC repair', 'Electrician')..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-4 border border-transparent rounded-lg bg-blue-800/20 backdrop-blur-sm placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-white"
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
                                className={`px-4 py-2 rounded-full transition-all duration-200 ${selectedCategory === category
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 shadow-sm'
                                    }`}
                            >
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
                        <p className="text-gray-600">
                            {isLoading ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </span>
                            ) : (
                                `${filteredServices.length} services available`
                            )}
                        </p>
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
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-pulse">
                                <div className="h-48 bg-gray-200"></div>
                                <div className="p-5 space-y-4">
                                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                        <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-800 mb-2">No services found</h3>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                            We couldn't find any services matching your criteria. Try adjusting your search or filters.
                        </p>
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

export default ServiceListingPage;