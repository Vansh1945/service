import React from 'react';
import { Clock, Star } from 'lucide-react';

const ServiceCard = ({ service, categoryMap, onBook, getMergedPrice }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL
    ? import.meta.env.VITE_BACKEND_URL.replace('/api', '')
    : window.location.origin;
  const defaultServiceImage = `${backendUrl}/assets/Service.png`;

  const imageUrl = service.displayImage || service.images?.[0] || service.image || defaultServiceImage;
  const isAvailable = service.isActive !== false;
  const categoryName = typeof service.category === 'object'
    ? service.category?.name
    : categoryMap[service.category] || 'Service';

  const displayRating = service.averageRating ? service.averageRating.toFixed(1) : '0.0';
  const displayRatingCount = service.ratingCount || 0;

  // Grid View Card
  return (
    <div className="group bg-white rounded-2xl border border-gray-150 hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col justify-between h-full">
      <div>
        {/* Image Container */}
        <div className="relative h-32 overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={service.title}
            className="w-full h-full object-cover"
            onError={(e) => e.target.src = defaultServiceImage}
          />
          {/* Top-Left Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {service.isFeatured && (
              <span className="text-[9px] font-black bg-amber-50/90 text-amber-700 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-amber-100">
                ★ Featured
              </span>
            )}
            {service.serviceType && service.serviceType !== 'standard' && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase shadow-sm tracking-wider text-white ${service.serviceType === 'emergency' ? 'bg-red-500' : 'bg-purple-600'
                }`}>
                {service.serviceType}
              </span>
            )}
            {!service.isFeatured && service.averageRating >= 4.5 && (
              <span className="text-[9px] font-black bg-emerald-50/90 text-emerald-700 backdrop-blur-sm px-1.5 py-0.5 rounded-md shadow-sm border border-emerald-100">
                ★ Popular
              </span>
            )}
          </div>
          {/* Bottom-Left Category Tag Overlay */}
          <div className="absolute bottom-2 left-2 z-10">
            <span className="text-[9px] font-extrabold bg-white/95 backdrop-blur-sm text-teal-700 px-2 py-0.5 rounded-lg shadow-md border border-teal-50">
              {categoryName}
            </span>
          </div>
        </div>

        {/* Details Container */}
        <div className="p-3">
          <h3 className="font-extrabold text-secondary text-sm line-clamp-1 mb-1 group-hover:text-primary transition-colors">
            {service.title}
          </h3>

          {service.shortDescription && (
            <p className="text-gray-500 text-xs line-clamp-2 mb-2 leading-relaxed">
              {service.shortDescription}
            </p>
          )}

          {/* Icons & Rating Row */}
          <div className="flex items-center justify-between mb-1 text-xs text-gray-500 font-medium">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{service.duration || 1} Hr</span>
            </div>
            <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-lg border border-gray-100">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
              <span className="text-xs font-bold text-secondary">{displayRating}</span>
              <span className="text-[10px] text-gray-400">({displayRatingCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Price & Button */}
      <div className="p-3 pt-0">
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex flex-col flex-shrink-0">
            {service.discountPrice ? (
              <>
                <span className="text-sm font-extrabold text-emerald-600 whitespace-nowrap">
                  ₹{getMergedPrice ? getMergedPrice(service.discountPrice)?.toLocaleString() : service.discountPrice?.toLocaleString()}
                </span>
                <span className="text-[10px] line-through text-gray-400 font-normal whitespace-nowrap">
                  ₹{getMergedPrice ? getMergedPrice(service.basePrice)?.toLocaleString() : service.basePrice?.toLocaleString()}
                </span>
              </>
            ) : (
              <span className="text-sm font-extrabold text-emerald-600 whitespace-nowrap">
                ₹{getMergedPrice ? getMergedPrice(service.basePrice)?.toLocaleString() : service.basePrice?.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={() => onBook(service._id, isAvailable)}
            disabled={!isAvailable}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all active:scale-95 whitespace-nowrap ${isAvailable
              ? 'bg-primary text-white hover:bg-primary/95 shadow-sm shadow-primary/10'
              : 'bg-gray-150 text-gray-400 cursor-not-allowed'
              }`}
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
