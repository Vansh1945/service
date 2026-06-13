import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import useSurchargeBooking from '../../../hooks/useSurchargeBooking';
import ServiceCard from './ServiceCard';

const RelatedServices = ({ services, categoryName, categoryId }) => {
  const navigate = useNavigate();
  const { getMergedPrice, handleBookNow } = useSurchargeBooking();

  if (!services || services.length === 0) return null;

  return (
    <div className="mt-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-secondary tracking-tight">Related {categoryName} Services</h2>
          <p className="text-gray-400 text-xs mt-0.5 font-medium">People also viewed these services</p>
        </div>
        <button
          onClick={() => navigate(`/customer/services-list?category=${categoryId}`)}
          className="flex items-center gap-1 text-primary font-bold text-[10px] uppercase tracking-widest hover:gap-2 transition-all"
        >
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="relative group/scroll">
        <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x scroll-smooth">
          {services.map((service) => {
            const catId = typeof service.category === 'object' ? service.category?._id : service.category;
            return (
              <div key={service._id} className="flex-shrink-0 snap-start w-[calc((100%-0.75*1rem)/1.75)] md:w-[calc((100%-2.25*1rem)/3.25)] lg:w-[calc((100%-5.25*1rem)/6.25)]">
                <ServiceCard
                  service={service}
                  categoryMap={{ [catId]: categoryName }}
                  onBook={handleBookNow}
                  getMergedPrice={getMergedPrice}
                />
              </div>
            );
          })}

          {/* View More Card */}
          {services.length >= 4 && (
            <div
              onClick={() => navigate(`/customer/services-list?category=${categoryId}`)}
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

export default RelatedServices;
