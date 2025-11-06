import React, { useState, useEffect } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useAuth } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import ServiceImg from '../assets/ServiceImg.png';

const HeroSection = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const { API } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch(`${API}/banner/banners`);
        const data = await response.json();
        if (data.success) {
          setBanners(data.data);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: false,
  };

  const renderBannerContent = (banner) => (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${banner.imageUrl})`,
        }}
      ></div>

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white py-20">
        <h1
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight font-poppins animate-fadeInDown"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.7)" }}
        >
          {banner.title}
        </h1>

        {banner.subtitle && (
          <p className="mt-4 text-lg md:text-xl text-white/90 animate-fadeInUp">
            {banner.subtitle}
          </p>
        )}
      </div>

      {/* CTA Button - Center Bottom */}
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-fadeInUp">
        <button
          onClick={() => navigate("/customer/services")}
          className="bg-accent hover:bg-accent/90 text-white font-semibold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          Get Started Now
        </button>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-accent/70 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="text-white text-xl">Loading...</div>
      </section>
    );
  }

  if (banners.length === 0) {
    // Default banner if no active banners
    return renderBannerContent({
      title: "Power Your Home & Business with Reliable Electrical Services",
      subtitle:
        "Expert wiring, repair, and maintenance for homes & industries in Jalandhar, Punjab.",
      imageUrl: ServiceImg,
      couponCode: null,
    });
  }

  return (
    <Slider {...sliderSettings}>
      {banners.map((banner) => (
        <div key={banner._id}>{renderBannerContent(banner)}</div>
      ))}
    </Slider>
  );
};

export default HeroSection;
