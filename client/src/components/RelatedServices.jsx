import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, IndianRupee, Star, ChevronRight } from 'lucide-react';
import Rating from '@mui/material/Rating';

const RelatedServices = ({ services, categoryName, categoryId }) => {
  const navigate = useNavigate();

  if (!services || services.length === 0) return null;

  return (
    <div className="mt-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-secondary tracking-tight">Related {categoryName} Services</h2>
          <p className="text-gray-400 text-xs mt-0.5 font-medium">People also viewed these services</p>
        </div>
        <button
          onClick={() => navigate(`/customer/services?category=${categoryId}`)}
          className="flex items-center gap-1 text-primary font-bold text-[10px] uppercase tracking-widest hover:gap-2 transition-all"
        >
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="relative group/scroll">
        <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x scroll-smooth">
          {services.map((service) => (
            <div key={service._id} className="flex-shrink-0 w-[240px] sm:w-[260px] snap-start">
              <ServiceCard
                service={service}
                categoryName={categoryName}
                onView={() => {
                  navigate(`/customer/services/${service._id}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          ))}

          {/* View More Card */}
          {services.length >= 4 && (
            <div
              onClick={() => navigate(`/customer/services?category=${categoryId}`)}
              className="flex-shrink-0 w-[120px] snap-start bg-gray-50/50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:bg-white hover:border-primary/30 transition-all cursor-pointer group/more"
            >
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary group-hover/more:scale-110 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">See All</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Internal Service Card (Matches Services.jsx)
const ServiceCard = ({ service, categoryName, onView }) => {
  const imageUrl = service.displayImage || service.images?.[0] || 'https://via.placeholder.com/400x300?text=Service';
  const isAvailable = service.isActive !== false;

  return (
    <div className="group bg-white rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="relative h-36 overflow-hidden cursor-pointer" onClick={onView}>
        <img
          src={imageUrl}
          alt={service.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => e.target.src = 'https://via.placeholder.com/400x300?text=Service'}
        />
        <div className="absolute top-2 left-2">
          <span className="text-xs font-medium bg-white/90 backdrop-blur-sm text-primary px-2 py-0.5 rounded-lg">
            {categoryName}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h3
          className="font-semibold text-secondary text-sm line-clamp-1 mb-1 cursor-pointer hover:text-primary transition-colors"
          onClick={onView}
        >
          {service.title}
        </h3>
        <p className="text-gray-500 text-xs line-clamp-2 mb-2">{service.description}</p>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Clock className="w-3 h-3" />
            <span>{service.duration || 1} hr</span>
          </div>
          <div className="flex items-center gap-1">
            <Rating value={service.averageRating || 0} precision={0.5} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: '#F97316' } }} />
            <span className="text-xs text-gray-500">({service.ratingCount || 0})</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-baseline gap-0.5">
            <IndianRupee className="w-3 h-3 text-secondary" />
            <span className="text-base font-bold text-secondary">{service.basePrice?.toLocaleString()}</span>
          </div>
          <button
            onClick={onView}
            disabled={!isAvailable}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${isAvailable
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {isAvailable ? 'View Detail' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelatedServices;
