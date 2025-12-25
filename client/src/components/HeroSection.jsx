import React, { useState, useEffect } from "react";
import { FaClock, FaCertificate } from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import { useAuth } from "../store/auth";

// Import Swiper styles
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/autoplay";

import ServiceImg from '../assets/ServiceImg.png';

const HeroSection = () => {
  const { API } = useAuth();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Default banner fallback
  const defaultBanner = {
    image: ServiceImg,
    title: "Power Your Home & Business with Reliable Electrical Services",
    subtitle: "Expert wiring, repair, and maintenance for homes & industries in Jalandhar, Punjab."
  };

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`${API}/system-setting/banners`);
        const bannersData = response.data.data; // bannersData is an array of banners

        if (bannersData && Array.isArray(bannersData)) {
          // Filter active banners based on current date
          const currentDate = new Date();
          const activeBanners = bannersData.filter(banner => {
            const startDate = new Date(banner.startDate);
            const endDate = new Date(banner.endDate);
            return currentDate >= startDate && currentDate <= endDate;
          });

          // If no active banners, use default
          setBanners(activeBanners.length > 0 ? activeBanners : [defaultBanner]);
        } else {
          setBanners([defaultBanner]);
        }
      } catch (err) {
        console.error("Error fetching banners:", err);
        setError("Failed to load banners. Showing default banner.");
        setBanners([defaultBanner]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [API]);

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gray-300 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-black/5 to-black/10"></div>
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="space-y-6 md:space-y-8">
          <div className="h-16 bg-gray-400 rounded animate-pulse"></div>
          <div className="h-6 bg-gray-400 rounded animate-pulse max-w-2xl mx-auto"></div>
          <div className="mt-12 md:mt-16 flex flex-wrap justify-center gap-6 md:gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-400 px-5 py-3 rounded-full animate-pulse">
                <div className="w-5 h-5 bg-gray-500 rounded"></div>
                <div className="w-32 h-4 bg-gray-500 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  

  if (loading) return <LoadingSkeleton />;
  if (error && banners.length === 0) return <ErrorDisplay />;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Swiper
        modules={[Autoplay, EffectFade]}
        effect="fade"
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        loop={banners.length > 1}
        className="absolute inset-0"
      >
        {banners.map((banner, index) => (
          <SwiperSlide key={index}>
            {/* Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${banner.image})`
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-black/5 to-black/10"></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full px-4 py-20 text-center flex items-center justify-center min-h-screen">
              <div className="max-w-7xl mx-auto">
                <header className="space-y-6 md:space-y-8">
                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight text-white font-poppins animate-fadeInDown" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                  {banner.title}
                </h1>

                {/* Subheading */}
                <p className="text-md sm:text-lg md:text-xl text-gray-200 max-w-4xl mx-auto leading-relaxed px-4 font-poppins animate-fadeInUp">
                  {banner.subtitle}
                </p>

                {/* Trust Indicators */}
                <div className="mt-12 md:mt-16 flex flex-wrap justify-center gap-6 md:gap-10 text-white/90 font-poppins">
                  <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
                    <FaClock className="text-accent text-base md:text-lg" />
                    <span className="text-base md:text-lg font-semibold">24/7 Emergency Service</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
                    <FaCertificate className="text-accent text-base md:text-lg" />
                    <span className="text-base md:text-lg font-semibold">Certified Electricians</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 shadow-lg hover:scale-105 transition-transform duration-300">
                    <FaShield className="text-accent text-base md:text-lg" />
                    <span className="text-base md:text-lg font-semibold">Licensed & Insured</span>
                  </div>
                </div>
                </header>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
