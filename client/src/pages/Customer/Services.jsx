import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Clock, IndianRupee, X, MapPin, Shield, Award, Users, ChevronRight, Heart, Share2 } from 'lucide-react';

const ServicesPage = () => {
    const [services, setServices] = useState([]);
    const [filteredServices, setFilteredServices] = useState([]);
    const [selectedService, setSelectedService] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('popular');
    const [showFilters, setShowFilters] = useState(false);

    const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

    // Categories for filtering
    const categories = ['All', 'Electrical', 'AC', 'Appliance Repair', 'Other'];

    // Fetch services
    useEffect(() => {
        const fetchServices = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API}/service/services`);
                const data = await response.json();
                
                if (data.success) {
                    setServices(data.data);
                    setFilteredServices(data.data);
                } else {
                    setError(data.message || 'Failed to fetch services');
                }
            } catch (err) {
                setError('Network error. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, [API]);

    // Filter and search services
    useEffect(() => {
        let filtered = services;

        // Category filter
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(service => service.category === selectedCategory);
        }

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(service =>
                service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                service.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'price-low':
                    return a.basePrice - b.basePrice;
                case 'price-high':
                    return b.basePrice - a.basePrice;
                case 'name':
                    return a.title.localeCompare(b.title);
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        setFilteredServices(filtered);
    }, [services, searchTerm, selectedCategory, sortBy]);

    const ServiceCard = ({ service }) => (
        <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group">
            <div className="relative overflow-hidden">
                <img
                    src={service.image ? `${API}/uploads/services/${service.image}` : '/api/service/placeholder/300/200'}
                    alt={service.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                    <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                        <Heart className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
                        <Share2 className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
                <div className="absolute bottom-3 left-3">
                    <span className="px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                        {service.category}
                    </span>
                </div>
            </div>

            <div className="p-5">
                <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {service.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {service.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{service.durationFormatted}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">4.8</span>
                        <span className="text-xs text-gray-500">(245)</span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <IndianRupee className="w-5 h-5 text-green-600" />
                        <span className="text-xl font-bold text-green-600">
                            {service.basePrice}
                        </span>
                    </div>
                    <button
                        onClick={() => setSelectedService(service)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2"
                    >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    const ServiceModal = ({ service, onClose }) => (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="relative">
                    <img
                        src={service.image ? `${API}/uploads/services/${service.image}` : '/api/service/placeholder/600/300'}
                        alt={service.title}
                        className="w-full h-64 object-cover rounded-t-2xl"
                    />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="absolute bottom-4 left-4">
                        <span className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                            {service.category}
                        </span>
                    </div>
                </div>

                <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">{service.title}</h2>
                    
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1">
                            <Star className="w-5 h-5 text-yellow-400 fill-current" />
                            <span className="font-medium">4.8</span>
                            <span className="text-gray-500">(245 reviews)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">{service.durationFormatted}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-500" />
                            <div>
                                <div className="font-medium text-sm">Insured</div>
                                <div className="text-xs text-gray-500">Full coverage</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <Award className="w-5 h-5 text-green-500" />
                            <div>
                                <div className="font-medium text-sm">Certified</div>
                                <div className="text-xs text-gray-500">Professionals</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                            <Users className="w-5 h-5 text-purple-500" />
                            <div>
                                <div className="font-medium text-sm">24/7</div>
                                <div className="text-xs text-gray-500">Support</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-semibold text-lg mb-3">Description</h3>
                        <p className="text-gray-600 leading-relaxed">{service.description}</p>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-semibold text-lg mb-3">What's Included</h3>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-600">Professional assessment</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-600">Quality service guarantee</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-600">Post-service support</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-600">Cleaning after work</span>
                            </li>
                        </ul>
                    </div>

                    <div className="border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-sm text-gray-500">Starting from</div>
                                <div className="flex items-center gap-1">
                                    <IndianRupee className="w-6 h-6 text-green-600" />
                                    <span className="text-3xl font-bold text-green-600">
                                        {service.basePrice}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Duration</div>
                                <div className="font-medium">{service.durationFormatted}</div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
                                Book Now
                            </button>
                            <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading services...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-xl mb-4">⚠️</div>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Our Services</h1>
                            <p className="text-gray-600 mt-1">Professional home services at your doorstep</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            <div className="relative flex-1 lg:w-80">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Category:</label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {categories.map(category => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="popular">Popular</option>
                                        <option value="price-low">Price: Low to High</option>
                                        <option value="price-high">Price: High to Low</option>
                                        <option value="name">Name</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Services Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {filteredServices.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400 text-6xl mb-4">🔍</div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No services found</h3>
                        <p className="text-gray-600">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex items-center justify-between">
                            <p className="text-gray-600">
                                Showing {filteredServices.length} of {services.length} services
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredServices.map((service) => (
                                <ServiceCard key={service._id} service={service} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Service Modal */}
            {selectedService && (
                <ServiceModal
                    service={selectedService}
                    onClose={() => setSelectedService(null)}
                />
            )}
        </div>
    );
};

export default ServicesPage;


// import React, { useState, useEffect } from 'react';
// import { Search, Filter, Star, Clock, MapPin, Phone, Mail, Award, X, Heart, Share2 } from 'lucide-react';

// const ServicesPage = () => {
//   const [services, setServices] = useState([]);
//   const [filteredServices, setFilteredServices] = useState([]);
//   const [selectedCategory, setSelectedCategory] = useState('All');
//   const [searchTerm, setSearchTerm] = useState('');
//   const [selectedService, setSelectedService] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [favorites, setFavorites] = useState(new Set());

//   const API = 'http://localhost:5000'; // Replace with your API URL

//   const categories = ['All', 'Electrical', 'AC', 'Appliance Repair', 'Other'];

//   useEffect(() => {
//     fetchServices();
//   }, []);

//   useEffect(() => {
//     filterServices();
//   }, [services, selectedCategory, searchTerm]);

//   const fetchServices = async () => {
//     try {
//       const response = await fetch(`${API}/api/service/services`);
//       const data = await response.json();
//       if (data.success) {
//         setServices(data.data);
//         setFilteredServices(data.data);
//       }
//     } catch (error) {
//       console.error('Error fetching services:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchServiceDetails = async (serviceId) => {
//     try {
//       const response = await fetch(`${API}/api/service/services/${serviceId}`);
//       const data = await response.json();
//       if (data.success) {
//         setSelectedService(data.data);
//       }
//     } catch (error) {
//       console.error('Error fetching service details:', error);
//     }
//   };

//   const filterServices = () => {
//     let filtered = services;

//     if (selectedCategory !== 'All') {
//       filtered = filtered.filter(service => service.category === selectedCategory);
//     }

//     if (searchTerm) {
//       filtered = filtered.filter(service =>
//         service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         service.description.toLowerCase().includes(searchTerm.toLowerCase())
//       );
//     }

//     setFilteredServices(filtered);
//   };

//   const toggleFavorite = (serviceId) => {
//     const newFavorites = new Set(favorites);
//     if (newFavorites.has(serviceId)) {
//       newFavorites.delete(serviceId);
//     } else {
//       newFavorites.add(serviceId);
//     }
//     setFavorites(newFavorites);
//   };

//   const ServiceCard = ({ service }) => (
//     <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer border border-gray-100">
//       <div className="relative">
//         <img 
//           src={service.image || '/api/service/placeholder/300/200'} 
//           alt={service.title}
//           className="w-full h-48 object-cover rounded-t-xl group-hover:scale-105 transition-transform duration-300"
//         />
//         <div className="absolute top-3 right-3 flex gap-2">
//           <button 
//             onClick={(e) => {
//               e.stopPropagation();
//               toggleFavorite(service._id);
//             }}
//             className={`p-2 rounded-full ${favorites.has(service._id) ? 'bg-red-500 text-white' : 'bg-white text-gray-600'} hover:scale-110 transition-all duration-200 shadow-md`}
//           >
//             <Heart size={16} fill={favorites.has(service._id) ? 'currentColor' : 'none'} />
//           </button>
//           <button className="p-2 rounded-full bg-white text-gray-600 hover:scale-110 transition-all duration-200 shadow-md">
//             <Share2 size={16} />
//           </button>
//         </div>
//         <div className="absolute top-3 left-3">
//           <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full font-medium">
//             {service.category}
//           </span>
//         </div>
//       </div>
      
//       <div className="p-4">
//         <h3 className="font-bold text-lg mb-2 text-gray-800 group-hover:text-blue-600 transition-colors duration-200">
//           {service.title}
//         </h3>
//         <p className="text-gray-600 text-sm mb-3 line-clamp-2">
//           {service.description}
//         </p>
        
//         <div className="flex items-center justify-between mb-3">
//           <div className="flex items-center gap-2">
//             <Clock size={16} className="text-gray-500" />
//             <span className="text-sm text-gray-600">{service.durationFormatted}</span>
//           </div>
//           <div className="flex items-center gap-1">
//             <Star size={16} className="text-yellow-400 fill-current" />
//             <span className="text-sm font-medium">4.5</span>
//             <span className="text-sm text-gray-500">(234)</span>
//           </div>
//         </div>
        
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <span className="text-2xl font-bold text-blue-600">₹{service.basePrice}</span>
//             <span className="text-sm text-gray-500 line-through">₹{Math.round(service.basePrice * 1.2)}</span>
//           </div>
//           <button 
//             onClick={() => fetchServiceDetails(service._id)}
//             className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium"
//           >
//             View Details
//           </button>
//         </div>
//       </div>
//     </div>
//   );

//   const ServiceModal = ({ service, onClose }) => {
//     if (!service) return null;

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//         <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//           <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center rounded-t-2xl">
//             <h2 className="text-2xl font-bold text-gray-800">Service Details</h2>
//             <button 
//               onClick={onClose}
//               className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
//             >
//               <X size={24} />
//             </button>
//           </div>
          
//           <div className="p-6">
//             <div className="grid md:grid-cols-2 gap-6">
//               <div>
//                 <img 
//                   src={service.image || '/api/service/placeholder/400/300'} 
//                   alt={service.title}
//                   className="w-full h-64 object-cover rounded-xl"
//                 />
//                 <div className="mt-4 flex gap-2">
//                   <button className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium">
//                     Book Now
//                   </button>
//                   <button className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium">
//                     Add to Cart
//                   </button>
//                 </div>
//               </div>
              
//               <div>
//                 <div className="flex items-center gap-2 mb-2">
//                   <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
//                     {service.category}
//                   </span>
//                   <div className="flex items-center gap-1">
//                     <Star size={16} className="text-yellow-400 fill-current" />
//                     <span className="text-sm font-medium">4.5</span>
//                     <span className="text-sm text-gray-500">(234 reviews)</span>
//                   </div>
//                 </div>
                
//                 <h1 className="text-3xl font-bold text-gray-800 mb-4">{service.title}</h1>
                
//                 <div className="flex items-center gap-4 mb-4">
//                   <div className="flex items-center gap-2">
//                     <Clock size={20} className="text-gray-500" />
//                     <span className="text-gray-600">{service.durationFormatted}</span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <MapPin size={20} className="text-gray-500" />
//                     <span className="text-gray-600">Available citywide</span>
//                   </div>
//                 </div>
                
//                 <div className="mb-6">
//                   <div className="flex items-center gap-3 mb-2">
//                     <span className="text-3xl font-bold text-blue-600">₹{service.basePrice}</span>
//                     <span className="text-lg text-gray-500 line-through">₹{Math.round(service.basePrice * 1.2)}</span>
//                     <span className="px-2 py-1 bg-green-100 text-green-600 text-sm rounded-full font-medium">
//                       {Math.round(((service.basePrice * 1.2) - service.basePrice) / (service.basePrice * 1.2) * 100)}% OFF
//                     </span>
//                   </div>
//                   <p className="text-sm text-gray-600">Starting price • Final price depends on your requirements</p>
//                 </div>
                
//                 <div className="border-t border-gray-200 pt-4">
//                   <h3 className="font-semibold text-lg mb-3">Description</h3>
//                   <p className="text-gray-600 leading-relaxed mb-4">{service.description}</p>
//                 </div>
                
//                 {service.providerPrices && service.providerPrices.length > 0 && (
//                   <div className="border-t border-gray-200 pt-4">
//                     <h3 className="font-semibold text-lg mb-3">Available Providers</h3>
//                     <div className="space-y-3">
//                       {service.providerPrices.map((pp, index) => (
//                         <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
//                           <div className="flex items-center gap-3">
//                             <img 
//                               src={pp.provider.profilePicUrl || '/api/service/placeholder/40/40'} 
//                               alt={pp.provider.name}
//                               className="w-10 h-10 rounded-full object-cover"
//                             />
//                             <div>
//                               <h4 className="font-medium">{pp.provider.name}</h4>
//                               <div className="flex items-center gap-1">
//                                 <Star size={14} className="text-yellow-400 fill-current" />
//                                 <span className="text-sm text-gray-600">4.8</span>
//                                 <Award size={14} className="text-blue-500 ml-1" />
//                               </div>
//                             </div>
//                           </div>
//                           <div className="text-right">
//                             <div className="font-bold text-blue-600">₹{pp.price}</div>
//                             {pp.discount > 0 && (
//                               <div className="text-sm text-green-600">{pp.discount}% off</div>
//                             )}
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading services...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white shadow-sm sticky top-0 z-40">
//         <div className="max-w-7xl mx-auto px-4 py-4">
//           <div className="flex flex-col md:flex-row gap-4 items-center">
//             <h1 className="text-2xl font-bold text-gray-800">Our Services</h1>
            
//             {/* Search Bar */}
//             <div className="relative flex-1 max-w-md">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//               <input
//                 type="text"
//                 placeholder="Search services..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>
            
//             {/* Category Filter */}
//             <div className="flex items-center gap-2 overflow-x-auto">
//               <Filter size={20} className="text-gray-500 flex-shrink-0" />
//               {categories.map(category => (
//                 <button
//                   key={category}
//                   onClick={() => setSelectedCategory(category)}
//                   className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors duration-200 ${
//                     selectedCategory === category
//                       ? 'bg-blue-500 text-white'
//                       : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
//                   }`}
//                 >
//                   {category}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Services Grid */}
//       <div className="max-w-7xl mx-auto px-4 py-8">
//         <div className="flex justify-between items-center mb-6">
//           <p className="text-gray-600">
//             {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} found
//           </p>
//           <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
//             <option>Sort by: Featured</option>
//             <option>Price: Low to High</option>
//             <option>Price: High to Low</option>
//             <option>Rating</option>
//           </select>
//         </div>

//         {filteredServices.length > 0 ? (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//             {filteredServices.map(service => (
//               <ServiceCard key={service._id} service={service} />
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-12">
//             <div className="text-gray-400 mb-4">
//               <Search size={48} className="mx-auto" />
//             </div>
//             <h3 className="text-xl font-medium text-gray-700 mb-2">No services found</h3>
//             <p className="text-gray-500">Try adjusting your search or filter criteria</p>
//           </div>
//         )}
//       </div>

//       {/* Service Modal */}
//       {selectedService && (
//         <ServiceModal 
//           service={selectedService} 
//           onClose={() => setSelectedService(null)} 
//         />
//       )}
//     </div>
//   );
// };

// export default ServicesPage;


