import React, { useEffect, useState } from "react";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { useAuth } from "../store/auth";

import "swiper/css";

import ServiceImg from "../assets/ServiceImg.png";

const HeroSection = () => {
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
        const res = await axios.get(`${API}/system-setting/banners`);
        const data = res?.data?.data || [];

        const today = new Date();
        const activeBanners = data.filter((b) => {
          if (!b.startDate || !b.endDate) return true;
          return (
            today >= new Date(b.startDate) &&
            today <= new Date(b.endDate)
          );
        });

        setBanners(activeBanners.length ? activeBanners : [defaultBanner]);
      } catch (error) {
        setBanners([defaultBanner]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [API]);

  if (loading) {
    return (
      <div className="mt-[64px] sm:mt-0 w-full h-[220px] sm:h-screen bg-gray-200 animate-pulse" />
    );
  }

  return (
    <section className="w-full overflow-hidden mt-[64px] sm:mt-0">
      <Swiper
        modules={[Autoplay]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        loop={banners.length > 1}
        className="w-full h-[220px] sm:h-screen"
      >
        {banners.map((banner, index) => {
          const hasText = banner?.title || banner?.subtitle;

          return (
            <SwiperSlide key={index}>
              <div className="relative w-full h-[220px] sm:h-screen overflow-hidden">

                {/* Blurred background */}
                <img
                  src={banner.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110"
                />

                {/* Main image */}
                <img
                  src={banner.image}
                  alt={banner.title || "banner"}
                  className="relative z-10 w-full h-full object-contain"
                />

                {/* Overlay ONLY if text exists */}
                {hasText && (
                  <>
                    <div className="absolute inset-0 z-20" />

                    {/* Desktop text */}
                    <div className="hidden sm:flex absolute inset-0 z-30 items-center justify-center text-center px-4">
                      <div className="max-w-5xl space-y-4">
                        {banner.title && (
                          <h1 className="text-3xl md:text-5xl font-extrabold text-accent/80 font-poppins">
                            {banner.title}
                          </h1>
                        )}
                        {banner.subtitle && (
                          <p className="text-lg md:text-xl text-gray-200 font-poppins">
                            {banner.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
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
