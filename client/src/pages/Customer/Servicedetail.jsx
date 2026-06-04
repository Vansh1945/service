import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import {
  MdStar, MdAccessTime, MdSecurity, MdCheck, MdCurrencyRupee,
  MdChevronRight, MdError, MdShare, MdArrowBack, MdArrowForward,
  MdPhoto, MdHome, MdCalendarToday, MdHelpOutline
} from 'react-icons/md';
import {
  StarIcon as StarIconSolid, ShieldCheckIcon, CheckBadgeIcon,
  WrenchIcon, UserIcon, ClockIcon, ChevronRightIcon, CheckIcon,
  ChatBubbleLeftEllipsisIcon, ChevronDownIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/Loader';
import RelatedServicesComponent from '../../components/RelatedServices';
import ErrorState from '../../components/Error';
import { getPublicServiceById, getServicesByCategory } from '../../services/ServiceService';
import useCategory from '../../hooks/useCategory';
import { formatCurrency, formatDate, formatDuration } from '../../utils/format';
import { resolveActiveSurcharges } from '../../services/SurgeService';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { API, showToast, isAuthenticated, user } = useAuth();

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
    if (!basePrice) return 0;
    let demandSurge = 0;
    activeSurcharges.forEach(s => {
      if (s.chargeType === 'demand') {
        if (s.maxBookingValue && basePrice > s.maxBookingValue) {
          return;
        }
        let chargeAmount = 0;
        if (s.mode === 'flat') {
          chargeAmount = s.value;
        } else if (s.mode === 'percentage') {
          chargeAmount = (basePrice * s.value) / 100;
        } else if (s.mode === 'multiplier') {
          chargeAmount = basePrice * (s.value - 1);
        }
        demandSurge += parseFloat(chargeAmount.toFixed(2));
      }
    });
    return basePrice + demandSurge;
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

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index);
    setImageLoading(true);
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

  const getRelatedCategoryName = (relatedCategory) => {
    if (!relatedCategory) return 'Uncategorized';
    if (typeof relatedCategory === 'object' && relatedCategory.name) {
      return relatedCategory.name;
    }
    if (typeof relatedCategory === 'string' && categories.length > 0) {
      const category = categories.find(cat => cat.value === relatedCategory);
      return category ? category.label : 'Uncategorized';
    }
    if (typeof relatedCategory === 'object' && relatedCategory.value && categories.length > 0) {
      const category = categories.find(cat => cat.value === relatedCategory.value);
      return category ? category.label : 'Uncategorized';
    }
    if (typeof relatedCategory === 'object' && relatedCategory._id && categories.length > 0) {
      const category = categories.find(cat => cat.value === relatedCategory._id);
      return category ? category.label : 'Uncategorized';
    }
    return 'Uncategorized';
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
      text: `Check out this ${service?.title} service from Raj Electrical Service`,
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

  // Placeholder FAQs
  const faqs = [
    { q: "What if the service takes longer than estimated?", a: "The price remains the same as quoted. Any additional costs for materials will be discussed beforehand." },
    { q: "Are the service professionals background checked?", a: "Yes, all our professionals undergo strict identity and background verification." },
    { q: "Do you provide a warranty for the service?", a: "We provide a 30-day service warranty on all professional bookings." }
  ];

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
        <nav className="flex text-sm text-gray-500 font-medium" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link to="/customer/services" className="hover:text-primary transition-colors flex items-center">
                <MdHome className="w-4 h-4 mr-1" />
                Home
              </Link>
            </li>
            <MdChevronRight className="w-4 h-4 text-gray-400" />
            <li>
              <button onClick={() => navigate(`/customer/services?category=${getCategoryId}`)} className="hover:text-primary transition-colors">
                {categoryName}
              </button>
            </li>
            <MdChevronRight className="w-4 h-4 text-gray-400" />
            <li className="text-secondary font-semibold truncate max-w-[200px]">
              {service.title}
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="md:grid md:grid-cols-2 gap-10 p-6 lg:p-10">

            {/* Left Column: Image Section */}
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
            </div>

            {/* Right Column: Service Details */}
            <div className="flex flex-col h-full mt-6 md:mt-0">
              <div className="flex-1 space-y-6">
                <div className="space-y-1.5">
                  <h1 className="text-xl lg:text-2xl font-bold text-secondary tracking-tight leading-tight">
                    {service.title}
                  </h1>

                  {/* Rating Section */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-primary/10 px-2 py-0.5 rounded-lg text-primary font-bold text-xs">
                      <MdStar className="mr-0.5" />
                      {service.averageRating?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-gray-400 text-xs font-medium border-l border-gray-200 pl-3">
                      {service.ratingCount || 0} Reviews
                    </div>
                  </div>
                </div>

                {/* Price Section */}
                <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl lg:text-3xl font-extrabold text-primary">{formatCurrency(getMergedPrice(service.basePrice))}</span>
                  </div>
                  <p className="text-gray-400 text-[11px] mt-1 font-medium">• Inclusive of all taxes • Direct Professional Service</p>
                </div>

                {/* CTA Section */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleBookNow}
                      className="flex-1 bg-accent hover:opacity-90 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-accent/15 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                      <MdCalendarToday size={18} />
                      BOOK SERVICE NOW
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center transition-all"
                    >
                      <MdShare size={20} />
                    </button>
                  </div>
                </div>

                {/* Note Section */}
                <div className="space-y-1 p-3 bg-amber-50/70 rounded-xl border border-amber-100">
                  <h3 className="text-amber-800 font-bold text-[9px] tracking-widest flex items-center gap-1.5 uppercase">
                    <MdError className="w-3.5 h-3.5" />
                    Note
                  </h3>
                  <p className="text-amber-700 text-xs font-semibold leading-relaxed">
                    Material cost is NOT included. Actual material charges will be extra.
                  </p>
                </div>

                {/* Features / Special Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <h4 className="text-gray-400 font-bold text-[9px] tracking-widest border-b border-gray-100 pb-1.5 uppercase">What's Included</h4>
                    <ul className="space-y-2">
                      {specialNotes.length > 0 ? specialNotes.map((note, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-gray-600">
                          <MdCheck className="text-primary mt-0.5 shrink-0" />
                          <span>{note}</span>
                        </li>
                      )) : <li className="text-gray-400 text-xs italic">Standard professional service</li>}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-gray-400 font-bold text-[9px] tracking-widest border-b border-gray-100 pb-1.5 uppercase">Tools & Materials</h4>
                    <ul className="space-y-2">
                      {materialsUsed.length > 0 ? materialsUsed.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-gray-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      )) : <li className="text-gray-400 text-xs italic">All pro-tools included</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Bottom Section (FAQ & Reviews) */}
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
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
                {tab === 'Reviews' ? `Customer Reviews (${service.feedback?.filter(r => r.comment && r.comment.trim() !== "").length || 0})` : tab}
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
                      { icon: <ShieldCheckIcon className="w-4.5 h-4.5" />, text: "30-Day Warranty" },
                      { icon: <UserIcon className="w-4.5 h-4.5" />, text: "Certified Pros" },
                      { icon: <ClockIcon className="w-4.5 h-4.5" />, text: "On-Time Arrival" },
                      { icon: <CheckBadgeIcon className="w-4.5 h-4.5" />, text: "Genuine Spares" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                        <div className="text-primary">{item.icon}</div>
                        <span className="text-xs font-semibold text-gray-600">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Specifications' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm lg:grid lg:grid-cols-2 gap-10">
              {/* Left Column: Tech Specs */}
              <div>
                <h3 className="text-base md:text-lg font-bold text-secondary mb-4 flex items-center gap-2">
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
              <div className="mt-8 lg:mt-0">
                <h3 className="text-base md:text-lg font-bold text-secondary mb-4 flex items-center gap-2">
                  <MdHelpOutline className="w-5 h-5 text-primary" />
                  Frequently Asked Questions
                </h3>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="border border-gray-100 rounded-xl p-3 hover:border-primary/20 transition-all cursor-pointer group"
                      onClick={() => toggleAccordion(index)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs md:text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
                          {faq.q}
                        </span>
                        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openAccordion === index ? 'rotate-180' : ''}`} />
                      </div>
                      {openAccordion === index && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed animate-fade-in">
                          {faq.a}
                        </p>
                      )}
                    </div>
                  ))}
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