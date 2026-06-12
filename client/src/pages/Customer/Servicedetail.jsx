import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import {
  MdStar, MdCheck,
  MdChevronRight, MdShare, MdArrowBack, MdArrowForward,
  MdHome, MdHelpOutline
} from 'react-icons/md';
import {
  StarIcon as StarIconSolid, ShieldCheckIcon, CheckBadgeIcon,
  WrenchIcon, UserIcon, ClockIcon,
  ChatBubbleLeftEllipsisIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/ui-skeletons/Loader';
import RelatedServicesComponent from '../../components/RelatedServices';
import ErrorState from '../../components/Error';
import { getPublicServiceById, getServicesByCategory } from '../../services/ServiceService';
import { getMergedPrice as getMergedPriceUtil } from '../../utils/surge';
import useCategory from '../../hooks/useCategory';
import { formatCurrency, formatDate, formatDuration } from '../../utils/format';
import { resolveActiveSurcharges } from '../../services/SurgeService';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, isAuthenticated, user, systemSettings = {} } = useAuth();

  // ==================== STATE MANAGEMENT ====================
  const [service, setService] = useState(null);
  const [relatedServices, setRelatedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [openAccordion, setOpenAccordion] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [allImages, setAllImages] = useState([]);
  const { categories } = useCategory();
  const [activeSurcharges, setActiveSurcharges] = useState([]);

  // Fetch active surcharges
  useEffect(() => {
    const fetchSurcharges = async () => {
      try {
        const params = {};
        if (user?.address?.lat && user?.address?.lng) {
          params.lat = user.address.lat;
          params.lng = user.address.lng;
        }
        const response = await resolveActiveSurcharges(params);
        if (response.data?.success) {
          setActiveSurcharges(response.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching active surcharges:", err);
      }
    };
    fetchSurcharges();
  }, [user]);

  // Helper to get merged price (base price + active demand surge)
  const getMergedPrice = (basePrice) => {
    return getMergedPriceUtil(basePrice, activeSurcharges);
  };

  // ==================== HELPER FUNCTIONS ====================

  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };


  // ==================== MEMOIZED VALUES ====================
  const categoryName = useMemo(() => {
    if (!service?.category) return 'Uncategorized';
    if (typeof service.category === 'object' && (service.category.name || service.category.label)) {
      return service.category.name || service.category.label;
    }
    if (typeof service.category === 'string' && categories.length > 0) {
      const category = categories.find(cat => cat.value === service.category);
      return category ? category.label : 'Uncategorized';
    }
    if (typeof service.category === 'object' && service.category.value && categories.length > 0) {
      const category = categories.find(cat => cat.value === service.category.value);
      return category ? category.label : 'Uncategorized';
    }
    if (typeof service.category === 'object' && service.category._id && categories.length > 0) {
      const category = categories.find(cat => cat.value === service.category._id);
      return category ? category.label : 'Uncategorized';
    }
    return 'Uncategorized';
  }, [service, categories]);

  const getCategoryId = useMemo(() => {
    if (!service?.category) return '';
    if (typeof service.category === 'object' && service.category._id) {
      return service.category._id;
    }
    if (typeof service.category === 'string') {
      return service.category;
    }
    return '';
  }, [service]);

  const ratingDistribution = useMemo(() => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (service?.feedback && service.feedback.length > 0) {
      for (const review of service.feedback) {
        if (distribution[review.rating] !== undefined) {
          distribution[review.rating]++;
        }
      }
    }
    return distribution;
  }, [service?.feedback]);

  // ==================== API CALLS ====================

  const fetchServiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const serviceResponse = await getPublicServiceById(id);
      const serviceData = serviceResponse.data;

      if (!serviceData.success || !serviceData.data) {
        throw new Error(serviceData.message || 'Service not found');
      }

      const serviceDetails = serviceData.data;
      setService(serviceDetails);

      // Process images
      const images = serviceDetails.images || [];
      setAllImages(images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
      ]);

      // Fetch related services
      if (serviceDetails.category) {
        try {
          const categoryId = typeof serviceDetails.category === 'object' ? serviceDetails.category._id : serviceDetails.category;
          const relatedResponse = await getServicesByCategory(categoryId);
          const relatedData = relatedResponse.data;

          if (relatedData.success) {
            const filteredRelated = relatedData.data.filter(s => s._id !== serviceDetails._id);
            setRelatedServices(filteredRelated);
          }
        } catch (relatedError) {
          console.log('Failed to fetch related services:', relatedError);
        }
      }
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };


  // ==================== EVENT HANDLERS ====================
  const handleBookNow = () => {
    if (!isAuthenticated) {
      showToast('Please login to book services', 'error');
      navigate('/login', { state: { from: `/customer/services/${id}` } });
      return;
    }
    navigate(`/customer/book-service/${id}`, {
      state: { serviceDetails: service, prefillBooking: location.state?.prefillBooking }
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: service?.title,
      text: `Check out this ${service?.title} service from ${systemSettings.companyName || "Raj Electrical Service"}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!', 'success');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
  };

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (id) fetchServiceData();
  }, [id]);

  // ==================== RENDER COMPONENTS ====================
  const specialNotes = service?.specialNotes || [];
  const materialsUsed = service?.materialsUsed || [];


  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (error || !service) {
    return (
      <ErrorState
        title="Service Not Found"
        message={error || "We couldn't find the service you are looking for."}
        onRetry={() => window.location.reload()}
        onBack={() => navigate('/customer/services')}
        backText="Browse Services"
      />
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Breadcrumb Section */}
      <div className="max-w-[95%] mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <nav className="flex text-xs md:text-sm text-gray-500 font-medium" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 sm:gap-2">
            <li>
              <Link to="/customer/services" className="hover:text-primary transition-colors flex items-center whitespace-nowrap">
                <MdHome className="w-4 h-4 mr-0.5" />
                Home
              </Link>
            </li>
            <MdChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <li className="truncate max-w-[100px] sm:max-w-[150px]">
              <button onClick={() => navigate(`/customer/services?category=${getCategoryId}`)} className="hover:text-primary transition-colors truncate whitespace-nowrap block w-full text-left">
                {categoryName}
              </button>
            </li>
            <MdChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <li className="text-secondary font-semibold truncate max-w-[120px] sm:max-w-[200px] whitespace-nowrap">
              {service.title}
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="md:grid md:grid-cols-2 gap-10 p-6 lg:p-10">

            {/* Left Column: Image Section with Thumbnails */}
            <div className="flex flex-col">
              <div className="relative aspect-[4/3] md:aspect-square md:max-h-[400px] w-full mx-auto rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                    <LoadingSpinner />
                  </div>
                )}
                <img
                  src={allImages[currentImageIndex]}
                  alt={service.title}
                  className={`w-full h-full object-contain transition-all duration-500 group-hover:scale-95 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={handleImageLoad}
                />

                {/* Counter Overlay */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-md backdrop-blur-sm z-20 tracking-widest">
                    {currentImageIndex + 1} / {allImages.length}
                  </div>
                )}

                {allImages.length > 1 && (
                  <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="p-1.5 rounded-full bg-white/90 shadow-md text-gray-600 hover:text-primary hover:bg-white transition-all">
                      <MdArrowBack size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="p-1.5 rounded-full bg-white/90 shadow-md text-gray-600 hover:text-primary hover:bg-white transition-all">
                      <MdArrowForward size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Thumbnails Row */}
              {allImages.length > 1 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-none">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 bg-gray-50 flex-shrink-0 transition-all ${currentImageIndex === idx ? 'border-primary shadow-md scale-95' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <img src={img} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Service Details */}
            <div className="flex flex-col h-full mt-6 md:mt-0 justify-between">
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold bg-teal-50 text-primary px-2.5 py-1 rounded-lg border border-teal-100/50 uppercase tracking-widest">
                    {categoryName}
                  </span>

                  <h1 className="text-2xl lg:text-3xl font-extrabold text-secondary tracking-tight leading-tight pt-1">
                    {service.title}
                  </h1>

                  {/* Rating & Dynamic details */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-1">
                      <MdStar className="text-amber-500 w-4 h-4" />
                      <span className="font-bold text-secondary">{service.averageRating?.toFixed(1) || '0.0'}</span>
                      <span>({service.ratingCount || 0} Reviews)</span>
                    </div>
                    <span>•</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600">
                      Verified Service
                    </span>
                  </div>
                </div>

                {/* Unified Price & CTA Row */}
                <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      {service.discountPrice ? (
                        <>
                          <span className="text-2xl lg:text-3xl font-black text-emerald-600">
                            {formatCurrency(getMergedPrice(service.discountPrice))}
                          </span>
                          <span className="text-sm line-through text-gray-400 font-normal">
                            {formatCurrency(getMergedPrice(service.basePrice))}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl lg:text-3xl font-black text-emerald-600">
                          {formatCurrency(getMergedPrice(service.basePrice))}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        {service.discountPrice ? 'Special Offer' : 'Standard Rate'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                      Inclusive of all taxes
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBookNow}
                      className="bg-accent hover:bg-accent/95 text-white font-extrabold py-3 px-6 rounded-xl shadow-md shadow-accent/10 transition-all active:scale-95 text-xs tracking-wider uppercase"
                    >
                      Book Service Now
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                    >
                      <MdShare size={18} />
                    </button>
                  </div>
                </div>

                {/* Key Specifications Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl border border-gray-100">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Duration</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                      <ClockIcon className="w-4 h-4 text-primary" />
                      <span>{service.duration || 1} Hr</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Warranty</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                      <ShieldCheckIcon className="w-4 h-4 text-primary" />
                      <span>{service.warranty?.duration ? `${service.warranty.duration} ${service.warranty.unit}` : 'Standard'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Service Type</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-secondary capitalize">
                      <WrenchIcon className="w-4 h-4 text-primary" />
                      <span>{service.serviceType || 'Standard'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Featured</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                      <StarIconSolid className="w-4 h-4 text-amber-500" />
                      <span>{service.isFeatured ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Prerequisites tags */}
                {service.tags && service.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {service.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* Tabs / Bottom Section (FAQ & Reviews) */}
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          <nav className="flex space-x-8 min-w-max">
            {['Overview', 'Specifications', 'Reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 border-b-2 font-semibold text-xs md:text-sm tracking-wide transition-all ${activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
              >
                {tab === 'Reviews' ? `Customer Reviews (${service.ratingCount || 0})` : tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="animate-fade-in min-h-[250px]">
          {activeTab === 'Overview' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-base md:text-lg font-bold text-secondary border-l-4 border-primary pl-3">Service Details</h3>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{service.description}</p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-base md:text-lg font-bold text-secondary border-l-4 border-primary pl-3">Service Guarantees</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ...(service?.warranty?.duration ? [{
                        icon: <ShieldCheckIcon className="w-4.5 h-4.5" />,
                        text: `${service.warranty.duration}-${service.warranty.unit === 'days' ? 'Day' : 'Month'} Warranty`
                      }] : []),
                      {
                        icon: <UserIcon className="w-4.5 h-4.5" />,
                        text: service?.serviceType === 'emergency' ? 'Emergency Pros' : service?.serviceType === 'premium' ? 'Premium Pros' : 'Certified Pros'
                      },
                      {
                        icon: <ClockIcon className="w-4.5 h-4.5" />,
                        text: 'On-Time Arrival'
                      },
                      {
                        icon: <CheckBadgeIcon className="w-4.5 h-4.5" />,
                        text: 'Genuine Spares'
                      }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                        <div className="text-primary">{item.icon}</div>
                        <span className="text-xs font-semibold text-gray-600">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Service Includes & Excludes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                {/* Service Includes */}
                <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                  <h3 className="text-emerald-700 font-extrabold text-xs tracking-wider uppercase border-b border-emerald-100/50 pb-2">
                    Service Includes
                  </h3>
                  <ul className="space-y-2">
                    {specialNotes && specialNotes.length > 0 ? specialNotes.map((note, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <MdCheck className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>{note}</span>
                      </li>
                    )) : (
                      <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <MdCheck className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>Standard professional {categoryName} service</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Service Excludes */}
                <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                  <h3 className="text-red-700 font-extrabold text-xs tracking-wider uppercase border-b border-red-100/50 pb-2">
                    Service Excludes
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                      <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                      <span>Spare parts / replacement materials cost</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                      <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                      <span>Additional civil or custom structural work</span>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                      <span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span>
                      <span>Any work outside the standard service scope</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Specifications' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column: Tech Specs */}
                <div className="space-y-4">
                  <h3 className="text-base md:text-lg font-bold text-secondary border-l-4 border-primary pl-3 flex items-center gap-2">
                    <WrenchIcon className="w-5 h-5 text-primary" />
                    Technical Details
                  </h3>
                  <div className="divide-y divide-gray-100 text-sm">
                    <div className="grid grid-cols-2 py-3">
                      <span className="text-gray-500 font-medium">Estimated Duration</span>
                      <span className="text-secondary font-semibold">{formatDuration(service.duration)}</span>
                    </div>
                    <div className="grid grid-cols-2 py-3">
                      <span className="text-gray-500 font-medium">Category</span>
                      <span className="text-secondary font-semibold">{categoryName}</span>
                    </div>
                    <div className="grid grid-cols-2 py-3">
                      <span className="text-gray-500 font-medium">Availability</span>
                      <span className={`font-semibold ${service.isActive ? 'text-primary' : 'text-red-500'}`}>
                        {service.isActive ? 'Ready for Booking' : 'Not Available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: FAQ */}
                {service.faqs && service.faqs.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-base md:text-lg font-bold text-secondary border-l-4 border-primary pl-3 flex items-center gap-2">
                      <MdHelpOutline className="w-5 h-5 text-primary" />
                      Frequently Asked Questions
                    </h3>
                    <div className="space-y-3">
                      {service.faqs.map((faq, index) => (
                        <div
                          key={index}
                          className="border border-gray-100 rounded-xl p-3 hover:border-primary/20 transition-all cursor-pointer group"
                          onClick={() => toggleAccordion(index)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs md:text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
                              {faq.question}
                            </span>
                            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openAccordion === index ? 'rotate-180' : ''}`} />
                          </div>
                          {openAccordion === index && (
                            <p className="mt-2 text-xs text-gray-500 leading-relaxed animate-fade-in">
                              {faq.answer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="hidden md:block" />
                )}
              </div>

              {/* Tools & Materials and Why Choose Us */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                {/* Tools & Materials */}
                <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                  <h3 className="text-sky-700 font-extrabold text-xs tracking-wider uppercase border-b border-sky-100/50 pb-2">
                    Tools & Materials Used
                  </h3>
                  <ul className="space-y-2">
                    {materialsUsed && materialsUsed.length > 0 ? materialsUsed.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    )) : (
                      <li className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                        <span>All professional installation tools included</span>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Why Choose Us */}
                <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100 space-y-3">
                  <h3 className="text-indigo-700 font-extrabold text-xs tracking-wider uppercase border-b border-indigo-100/50 pb-2">
                    Why Choose {systemSettings.companyName || "Raj Electrical"}?
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "100% Certified, Background-Verified Technicians",
                      "On-Time Arrival and service execution guarantee",
                      "Transparent pricing upfront with no hidden charges",
                      "Safe, clean, and post-service cleanup process"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                        <MdCheck className="text-indigo-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Reviews' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row gap-8">
                {/* Left Side: Global Score */}
                <div className="text-center md:text-left min-w-[120px]">
                  <div className="text-4xl md:text-5xl font-extrabold text-secondary mb-1">{service.averageRating?.toFixed(1) || '0.0'}</div>
                  <div className="flex justify-center md:justify-start items-center gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <MdStar key={star} className={`w-4 h-4 ${star <= (service.averageRating || 0) ? 'text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{service.ratingCount || 0} Reviews</div>
                </div>

                {/* Right Side: Progress Bars AND Comments Grid */}
                <div className="flex-1 w-full flex flex-col xl:flex-row gap-8">
                  {/* Progress Bars */}
                  <div className="w-full xl:w-1/3 space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = ratingDistribution[rating];
                      const percentage = service.ratingCount > 0 ? (count / service.ratingCount) * 100 : 0;
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-500 w-5">{rating}★</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{percentage.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comments Grid */}
                  <div className="flex-1">
                    <div className="grid grid-cols-1 gap-4">
                      {service.feedback?.filter(r => r.comment && r.comment.trim() !== "").length > 0 ? (
                        service.feedback
                          .filter(review => review.comment && review.comment.trim() !== "")
                          .map((review, index) => (
                            <div key={index} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group text-xs md:text-sm">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-xs">
                                  {review.customer?.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold text-secondary group-hover:text-primary transition-colors">{review.customer?.name || 'Verified Customer'}</div>
                                  <div className="text-[9px] uppercase font-black text-gray-400 tracking-wider">
                                    {formatDate(review.createdAt)}
                                  </div>
                                </div>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <MdStar key={s} className={`w-3 h-3 ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`} />
                                  ))}
                                </div>
                              </div>
                              <p className="text-gray-600 leading-relaxed italic border-l-2 border-gray-100 pl-3">
                                {review.comment}
                              </p>
                            </div>
                          ))
                      ) : (
                        <div className="py-12 px-6 text-center bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-dashed border-gray-200 shadow-inner flex flex-col items-center justify-center w-full">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary animate-pulse">
                            <ChatBubbleLeftEllipsisIcon className="w-8 h-8" />
                          </div>
                          <h4 className="text-secondary font-bold text-sm mb-1">No Reviews Yet</h4>
                          <p className="text-gray-400 text-xs max-w-[250px] leading-relaxed">
                            There are currently no review comments for this service. Book now and be the first to share your experience!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Services Section */}
      <div className="bg-gray-50/50 border-t border-gray-100 mt-2">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
          <RelatedServicesComponent
            services={relatedServices}
            categoryName={categoryName}
            categoryId={getCategoryId}
            activeSurcharges={activeSurcharges}
          />
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;