import React, { useState, useEffect } from 'react';
import {
  Clock, IndianRupee, Star, ShieldCheck, MapPin, Search, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/auth';
import Rating from '@mui/material/Rating';
import LoadingSpinner from '../components/Loader';

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

  const ServiceCard = ({ service }) => {
    const imageUrl = service.displayImage || (service.images && service.images[0]) || service.image || 'https://via.placeholder.com/400x300?text=Service';
    const isAvailable = service.isActive !== false;

    return (
      <div className="group bg-white rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full ring-1 ring-gray-100">
        {/* Image Area */}
        <div className="relative h-36 md:h-44 overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            onError={(e) => e.target.src = 'https://via.placeholder.com/400x300?text=Service'}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold bg-white/95 backdrop-blur-sm text-primary px-2 py-0.5 rounded-lg shadow-sm">
              {service.category?.name || 'Service'}
            </span>
          </div>
          {service.basePrice > 1500 && (
            <div className="absolute top-2 right-2">
              <span className="text-[10px] uppercase font-bold bg-accent text-secondary px-2 py-0.5 rounded-lg shadow-sm">
                Premium
              </span>
            </div>
          )}
        </div>

        {/* Info Area */}
        <div className="p-3 md:p-4 flex flex-col flex-grow">
          <div className="flex-grow">
            <h3 className="font-bold text-secondary text-sm md:text-base mb-1 line-clamp-1 group-hover:text-primary transition-colors duration-300 leading-tight">
              {service.title}
            </h3>
            <p className="text-gray-500 text-xs line-clamp-2 mb-3 leading-relaxed font-normal">
              {service.description}
            </p>
          </div>

          {/* Metrics */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 text-gray-500">
              <Clock className="w-3 h-3" />
              <span className="text-[11px] font-medium">
                {service.duration || 1} hr
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Rating
                value={service.averageRating || 4.5}
                precision={0.5}
                readOnly
                size="small"
                sx={{ '& .MuiRating-iconFilled': { color: '#F97316' }, fontSize: '14px' }}
              />
              <span className="text-[10px] text-gray-400">({service.ratingCount || 0})</span>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
            <div className="flex flex-col">
              <div className="flex items-center text-secondary">
                <IndianRupee className="w-3.5 h-3.5 font-bold" />
                <span className="font-bold text-secondary text-sm md:text-lg">
                  {service.basePrice?.toLocaleString()}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBookNow(service._id, isAvailable);
              }}
              disabled={!isAvailable}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 ${isAvailable
                ? 'bg-primary text-white hover:bg-primary/90 hover:shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              {isAvailable ? 'Book' : 'Off'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  const displayedServices = limit ? services.slice(0, limit) : services;

  return (
    <section className={`bg-transparent min-h-screen ${limit ? 'py-8' : 'py-20'} px-4 md:px-8`}>
      <div className="max-w-[1500px] mx-auto">
        {!limit && (
          <div className="mb-10 text-center">
            <h2 className="text-xl md:text-2xl font-extrabold text-secondary tracking-tight mb-1">Our Electrical Services</h2>
            <p className="text-gray-400 text-sm font-medium">Get professional help for all your electric needs.</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {displayedServices.map((service) => (
            <ServiceCard key={service._id} service={service} />
          ))}
        </div>

        {services.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-secondary mb-2">No Services Found</h3>
            <p className="text-gray-500 mb-6">We're working hard to bring more services to you.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-50 text-secondary font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Services;
