import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Clock, IndianRupee, ChevronRight,
  CheckCircle, Loader2, AlertCircle, RefreshCw, MapPin,
  Sliders, ChevronDown, ChevronUp, Star, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../store/auth';
import Rating from '@mui/material/Rating';

const Services = ({ limit }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { API, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchServices = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`${API}/service/services`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to fetch services');
                }

                if (data.success && data.data) {
                    // Transform the data to ensure image field is properly handled
                    const transformedData = data.data.map(service => ({
                        ...service,
                        displayImage: service.images && service.images.length > 0 ? service.images[0] : service.image || null
                    }));
                    setServices(transformedData);
                } else {
                    setServices([]);
                }
            } catch (err) {
                console.error('Error fetching services:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, [API]);

    // Handle booking navigation
    const handleBookNow = (serviceId, isActive) => {
        if (!isActive) {
            toast.error('This service is currently unavailable');
            return;
        }

        if (!user) {
            toast.info('Please login to book a service');
            navigate(`/login?redirectTo=/services/${serviceId}`);
            return;
        }

        navigate(`/customer/services/${serviceId}`);
    };

    // Service Card Component
    const ServiceCard = ({ service }) => {
        const imageUrl = service.displayImage ||
          (service.images && service.images.length > 0 ? service.images[0] :
           service.image || '/placeholder-service.jpg');

        const isServiceAvailable = service.isActive !== false;

        return (
          <div className="flex flex-col h-full bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 overflow-hidden">
            {/* Service Image */}
            <div className="relative h-48 overflow-hidden flex-shrink-0 bg-gray-50">
              <img
                src={imageUrl}
                alt={service.title || 'Service'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/placeholder-service.jpg';
                }}
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3">
                {isServiceAvailable ? (
                  <span className="bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                    Available
                  </span>
                ) : (
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                    Unavailable
                  </span>
                )}
              </div>

              {/* Premium Badge */}
              {service.basePrice > 1000 && (
                <div className="absolute top-3 right-3 bg-accent text-secondary px-2 py-1 rounded-full text-xs font-bold shadow-sm">
                  Premium
                </div>
              )}

              {/* Category Badge */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-secondary px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                {service.category || 'Service'}
              </div>
            </div>

            {/* Service Details */}
            <div className="flex flex-col flex-grow p-4">
              <h3 className="font-bold text-secondary mb-2 line-clamp-2 text-lg leading-tight">
                {service.title}
              </h3>

              <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed flex-grow">
                {service.description}
              </p>

              {/* Rating and Duration */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-sm text-primary font-medium">
                    {service.durationFormatted || `${service.duration || 1} hrs`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Rating
                    name="read-only"
                    value={service.averageRating || 0}
                    precision={0.5}
                    readOnly
                    size="small"
                    sx={{
                      '& .MuiRating-iconFilled': {
                        color: '#F97316',
                      },
                      fontSize: '14px'
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    ({service.ratingCount || 0})
                  </span>
                </div>
              </div>

              {/* Price and Book Button */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  <span className="text-lg font-bold text-secondary">
                    ₹{service.basePrice?.toLocaleString() || '0'}
                  </span>
                  <p className="text-xs text-gray-500">Starting price</p>
                </div>
                <button
                  onClick={() => handleBookNow(service._id, isServiceAvailable)}
                  disabled={!isServiceAvailable}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
                    isServiceAvailable
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isServiceAvailable ? (
                    <>
                      Book Now
                    </>
                  ) : 'Unavailable'}
                </button>
              </div>
            </div>
          </div>
        );
    };

    // Loading Skeleton Component
    const ServiceCardSkeleton = () => (
        <div className="flex flex-col h-full bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-200"></div>

        </div>
    );

    if (loading) {
        return (
            <section className="py-20 px-6 sm:px-10 lg:px-16 bg-transparent min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-xl text-gray-600">Loading services...</p>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="py-20 px-6 sm:px-10 lg:px-16 bg-transparent min-h-screen flex flex-col justify-center">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl font-extrabold text-primary mb-6 font-poppins">
                            Our Electrical Services
                        </h2>
                        <p className="text-xl text-red-600 max-w-3xl mx-auto leading-relaxed font-inter">
                            Error loading services: {error}
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // Determine displayed services and header
    const displayedServices = limit ? services.slice(0, limit) : services;
    const isLimited = limit && services.length > limit;

    // If limit is provided, render only the grid for embedding
    if (limit) {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center py-8">
                    <p className="text-red-600">Error loading services: {error}</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayedServices.map((service) => (
                    <ServiceCard key={service._id} service={service} />
                ))}
            </div>
        );
    }

    // Full page render
    return (
        <section className="py-20 px-6 sm:px-10 lg:px-16 bg-transparent min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-20">
                    <h2 className="text-5xl font-extrabold text-primary mb-6 font-poppins">
                        Our Electrical Services
                    </h2>
                    <p className="text-xl text-secondary max-w-3xl mx-auto leading-relaxed font-inter">
                        Explore our wide range of electrical services designed to meet your needs.
                    </p>
                </div>

                {/* Services Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {services.map((service) => (
                        <ServiceCard key={service._id} service={service} />
                    ))}
                </div>
            </div>
        </section>
    );

};

export default Services;
