import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/auth';
import ServiceCardSkeleton from '../components/ui-skeletons/ServiceCardSkeleton';
import { getActiveServices } from '../services/ServiceService';
import ServiceCard from './Customer/components/ServiceCard';
import useCategory from '../hooks/useCategory';
import useSurchargeBooking from '../hooks/useSurchargeBooking';

const Services = ({ limit }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const sliderRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const { categories } = useCategory();
  const { getMergedPrice, handleBookNow } = useSurchargeBooking();

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.label }), {});
  }, [categories]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getActiveServices();
        const data = response.data;

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
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (loading || services.length === 0 || isHovered) return;

    const interval = setInterval(() => {
      if (sliderRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
        // If we have reached the end, scroll back to the start
        if (scrollLeft + clientWidth >= scrollWidth - 15) {
          sliderRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          const firstChild = sliderRef.current.firstElementChild;
          const cardWidth = firstChild ? firstChild.getBoundingClientRect().width : 300;
          const gap = window.innerWidth >= 768 ? 24 : 16;
          sliderRef.current.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
        }
      }
    }, 4000); // Scroll every 4 seconds

    return () => clearInterval(interval);
  }, [services, loading, isHovered]);

  const scrollSlider = (direction) => {
    if (sliderRef.current) {
      const { scrollLeft, clientWidth } = sliderRef.current;
      // Scroll by roughly 1 card width + gap (approx 300px)
      const scrollAmount = direction === 'left' ? -300 : 300;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <section className="bg-transparent py-2 px-4 md:px-8">
        <div className="w-full">
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide">
            {Array.from({ length: limit || 6 }).map((_, i) => (
              <div key={i} className="w-[calc((100%-16px)/2)] sm:w-[calc((100%-48px)/3.5)] md:w-[calc((100%-72px)/3.5)] lg:w-[calc((100%-144px)/6.5)] flex-shrink-0">
                <ServiceCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const displayedServices = limit ? services.slice(0, limit) : services;

  return (
    <section className="bg-transparent py-2 px-4 md:px-8 relative group/section">
      <div className="w-full relative">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl md:text-2xl font-extrabold text-secondary font-poppins">
            Popular Services
          </h2>
          <Link
            to="/customer/services-list"
            className="text-xs md:text-sm font-bold text-primary hover:text-teal-800 transition-colors flex items-center gap-1 group/link"
          >
            View All Services
            <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Left Arrow Button */}
          <button
            onClick={() => scrollSlider('left')}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-150 rounded-full flex items-center justify-center shadow-lg text-secondary hover:text-primary active:scale-90 transition-all opacity-0 group-hover/section:opacity-100 disabled:opacity-0"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right Arrow Button */}
          <button
            onClick={() => scrollSlider('right')}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-150 rounded-full flex items-center justify-center shadow-lg text-secondary hover:text-primary active:scale-90 transition-all opacity-0 group-hover/section:opacity-100 disabled:opacity-0"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Slider Content */}
          <div
            ref={sliderRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
            className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {displayedServices.map((service) => (
              <div
                key={service._id}
                className="w-[calc((100%-16px)/2)] sm:w-[calc((100%-48px)/3.5)] md:w-[calc((100%-72px)/3.5)] lg:w-[calc((100%-144px)/6.5)] flex-shrink-0 snap-start"
              >
                <ServiceCard
                  service={service}
                  categoryMap={categoryMap}
                  onBook={handleBookNow}
                  getMergedPrice={getMergedPrice}
                />
              </div>
            ))}
          </div>
        </div>

        {services.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-secondary mb-2">No Services Found</h3>
            <p className="text-gray-500 mb-6">We're working hard to bring more services to you.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-50 text-secondary font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Services;
