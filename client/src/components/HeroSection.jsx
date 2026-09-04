import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { useAuth } from "../context/auth";

import "swiper/css";
import "swiper/css/pagination";

import ServiceImg from "../assets/ServiceImg.webp";
import LoadingSpinner from "./ui/Loader";
import { getBanners } from "../services/SystemService";

const HeroSection = ({ noMargin = false }) => {
  const { API } = useAuth();
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const defaultBanner = {
    image: ServiceImg,
    title: "Power Your Home & Business with Reliable Electrical Services",
    subtitle:
      "Expert wiring, repair, and maintenance for homes & industries across North India.",
    link: "/customer/services-list?category=All",
    isDefault: true,
  };

  const handleBannerClick = (banner) => {
    const targetLink = banner.link?.trim() || "/customer/services-list?category=All";
    if (targetLink.startsWith("http://") || targetLink.startsWith("https://")) {
      window.open(targetLink, "_blank");
    } else {
      navigate(targetLink);
    }
  };

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await getBanners();
        const data = res?.data?.data || [];

        const activeBanners = data.filter((b) => {
          // Safety net: skip soft-deleted (backend already filters this)
          if (b.isDeleted) return false;
          const now = new Date();
          // If startDate is set, banner must have started
          if (b.startDate && now < new Date(b.startDate)) return false;
          // If endDate is set, banner must not have expired
          if (b.endDate && now > new Date(b.endDate)) return false;
          // No date restrictions or within valid range → show
          return true;
        });

        // Remove duplicates by _id or image
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
        console.error(error);
        setBanners([defaultBanner]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [API]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <section className={`w-full overflow-hidden px-2 pb-2 md:pb-3 relative ${noMargin ? 'pt-0 md:pt-0' : 'pt-4 md:pt-6 mt-16 md:mt-18 lg:mt-20'}`}>
      <div className="relative w-full group">
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          loop={banners.length > 1}
          spaceBetween={20}
          pagination={{ clickable: true }}
          breakpoints={{
            320: { slidesPerView: 1.1 },
            640: { slidesPerView: 1.5 },
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          className="w-full pb-6"
        >
          {banners.map((banner, index) => {
            const isDefault = banner.isDefault;

            return (
              <SwiperSlide key={banner._id ? `${banner._id}-${index}` : `${banner.image}-${index}`}>
                <div
                  onClick={() => handleBannerClick(banner)}
                  className="relative w-full h-[140px] sm:h-[180px] md:h-[220px] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                >
                  {/* Main image */}
                  <img
                    src={banner.image}
                    alt={banner.title || "Raj Electrical Service Banner"}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    width={800}
                    height={450}
                    className="w-full h-full object-cover"
                  />

                  {/* Render text overlay ONLY for default banner if backend didn't supply custom designed graphics */}
                  {isDefault && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 w-full p-4 z-10">
                        {banner.title && (
                          <h3 className="text-sm sm:text-base md:text-lg font-bold text-white font-poppins line-clamp-1">
                            {banner.title}
                          </h3>
                        )}
                        {banner.subtitle && (
                          <p className="text-xxs sm:text-xs md:text-sm text-gray-300 font-poppins line-clamp-2 mt-1">
                            {banner.subtitle}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>

      {/* Custom Styles to Override Swiper Bullets color to match the design (e.g. brownish active dot) */}
      <style>{`
        .swiper-pagination-bullet {
          background: #d1d5db !important;
          opacity: 1 !important;
          width: 8px !important;
          height: 8px !important;
          transition: all 0.3s ease;
        }
        .swiper-pagination-bullet-active {
          background: #FF5E00 !important; /* warm brown matching brand */
          width: 24px !important;
          border-radius: 4px !important;
        }
      `}</style>
    </section>
  );
};

export default HeroSection;