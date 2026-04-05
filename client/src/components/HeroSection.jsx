import React, { useEffect, useState } from "react";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useAuth } from "../context/auth";

import "swiper/css";
import "swiper/css/pagination";

import ServiceImg from "../assets/ServiceImg.png";
import LoadingSpinner from "./Loader";
import { getBanners } from "../services/SystemService";

const HeroSection = ({ noMargin = false }) => {
  const { API } = useAuth();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const defaultBanner = {
    image: ServiceImg,
    title: "Power Your Home & Business with Reliable Electrical Services",
    subtitle:
      "Expert wiring, repair, and maintenance for homes & industries in Jalandhar, Punjab.",
  };

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await getBanners();
        const data = res?.data?.data || [];

        const today = new Date();
        const activeBanners = data.filter((b) => {
          if (!b.startDate || !b.endDate) return true;
          return (
            today >= new Date(b.startDate) &&
            today <= new Date(b.endDate)
          );
        });

        // 1. Remove duplicates manually by _id or image
        const uniqueBanners = [];
        const seen = new Set();
        for (const banner of activeBanners) {
          const key = banner._id || banner.image;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueBanners.push(banner);
          }
        }

        let finalBanners = uniqueBanners.length > 0 ? uniqueBanners : [defaultBanner];

        // If we have between 2-3 banners, Swiper's loop breaks because desktop shows 3 slides (slidesPerView=3)
        // Duplicating the array gives it enough clones to infinitely scroll/autoplay smoothly.
        if (finalBanners.length > 1 && finalBanners.length < 4) {
          finalBanners = [...finalBanners, ...finalBanners, ...finalBanners].slice(0, 6);
        }

        setBanners(finalBanners);
      } catch (error) {
        setBanners([defaultBanner]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [API]);

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <section className={`w-full overflow-hidden px-3 md:px-6 py-4 md:py-6 ${noMargin ? '' : 'mt-16 md:mt-18 lg:mt-20'}`}>
      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        loop={banners.length > 1}
        spaceBetween={16}
        pagination={{ clickable: true, dynamicBullets: true }}
        breakpoints={{
          320: { slidesPerView: 1.2 },
          768: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        }}
        className="w-full h-[200px] md:h-[240px] pb-8" // Added pb-8 for pagination dots
      >
        {banners.map((banner, index) => {
          const hasText = banner?.title || banner?.subtitle;

          return (
            <SwiperSlide key={index} className="h-full">
              <div className="relative w-full h-[180px] md:h-[220px] rounded-xl overflow-hidden shadow-md cursor-pointer group">

                {/* Main image */}
                <div className="relative w-full h-full">
                  <img
                    src={banner.image}
                    alt={banner.title || "banner"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Subtle dark gradient overlay at the bottom for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                </div>

                {/* Text Overlay - Bottom Left */}
                {hasText && (
                  <div className="absolute bottom-0 left-0 w-full p-4 z-30">
                    {banner.title && (
                      <h3 className="text-base md:text-lg font-bold text-white font-poppins line-clamp-1">
                        {banner.title}
                      </h3>
                    )}
                    {banner.subtitle && (
                      <p className="text-xs md:text-sm text-gray-300 font-poppins line-clamp-2 mt-1">
                        {banner.subtitle}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
};

export default HeroSection;