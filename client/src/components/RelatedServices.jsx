import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, IndianRupee, Star, ChevronRight } from 'lucide-react';
import Rating from '@mui/material/Rating';
import { getMergedPrice as getMergedPriceUtil } from '../utils/surge';

const RelatedServices = ({ services, categoryName, categoryId, activeSurcharges }) => {
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
            <div key={service._id} className="flex-shrink-0 snap-start w-[calc((100%-0.75*1rem)/1.75)] md:w-[calc((100%-2.25*1rem)/3.25)] lg:w-[calc((100%-5.25*1rem)/6.25)]">
              <ServiceCard
                service={service}
                categoryName={categoryName}
                activeSurcharges={activeSurcharges}
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
const ServiceCard = ({ service, categoryName, onView, activeSurcharges }) => {
  const imageUrl = service.displayImage || service.images?.[0] || 'https://via.placeholder.com/400x300?text=Service';
  const isAvailable = service.isActive !== false;

  const getMergedPrice = (basePrice) => {
    return getMergedPriceUtil(basePrice, activeSurcharges);
  };

  const displayRating = service.averageRating ? service.averageRating.toFixed(1) : '0.0';
  const displayRatingCount = service.ratingCount || 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-150 hover:border-primary/40 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between transform hover:-translate-y-0.5 h-full">
      <div>
        {/* Image Container */}
        <div className="relative h-40 overflow-hidden bg-gray-50 cursor-pointer" onClick={onView}>
          <img
            src={imageUrl}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => e.target.src = 'https://via.placeholder.com/400x300?text=Service'}
          />
          {/* Top-Left Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {service.isFeatured && (
              <span className="text-[9px] font-black bg-amber-50/90 text-amber-700 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm border border-amber-100 flex items-center gap-1">
                ★ Featured
              </span>
            )}
            {service.serviceType && service.serviceType !== 'standard' && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase shadow-sm tracking-wider text-white ${
                service.serviceType === 'emergency' ? 'bg-red-500' : 'bg-purple-600'
              }`}>
                {service.serviceType}
              </span>
            )}
            {!service.isFeatured && service.averageRating >= 4.5 && (
              <span className="text-[9px] font-black bg-emerald-50/90 text-emerald-700 backdrop-blur-sm px-2 py-0.5 rounded-md shadow-sm border border-emerald-100 flex items-center gap-1">
                ★ Popular
              </span>
            )}
          </div>
          {/* Bottom-Left Category Tag Overlay */}
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="text-[10px] font-extrabold bg-white/95 backdrop-blur-sm text-teal-700 px-2.5 py-1 rounded-lg shadow-md border border-teal-50">
              {categoryName}
            </span>
          </div>
        </div>

        {/* Details Container */}
        <div className="p-4">
          <h3
            className="font-extrabold text-secondary text-sm line-clamp-1 mb-1 cursor-pointer hover:text-primary transition-colors"
            onClick={onView}
          >
            {service.title}
          </h3>
          
          {service.shortDescription ? (
            <p className="text-gray-500 text-xs line-clamp-2 mb-3 leading-relaxed">
              {service.shortDescription}
            </p>
          ) : (
            <p className="text-gray-500 text-xs line-clamp-2 mb-3 leading-relaxed">
              {service.description}
            </p>
          )}

          {/* Icons & Rating Row (Duration on Left, Rating on Right) */}
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500 font-medium">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{service.duration || 1} Hr</span>
            </div>
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
              <span className="text-xs font-bold text-secondary">{displayRating}</span>
              <span className="text-[10px] text-gray-400">({displayRatingCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Price & Button */}
      <div className="p-4 pt-0">
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex flex-col flex-shrink-0">
            {service.discountPrice ? (
              <>
                <span className="text-base font-extrabold text-emerald-600 whitespace-nowrap">
                  ₹{getMergedPrice(service.discountPrice)?.toLocaleString()}
                </span>
                <span className="text-[10px] line-through text-gray-400 font-normal whitespace-nowrap">
                  ₹{getMergedPrice(service.basePrice)?.toLocaleString()}
                </span>
              </>
            ) : (
              <span className="text-base font-extrabold text-emerald-600 whitespace-nowrap">
                ₹{getMergedPrice(service.basePrice)?.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={onView}
            disabled={!isAvailable}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all active:scale-95 ${isAvailable
              ? 'bg-primary text-white hover:bg-primary/95 shadow-sm shadow-primary/10'
              : 'bg-gray-150 text-gray-400 cursor-not-allowed'
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
