import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import {
  MdStar, MdAccessTime, MdSecurity, MdCheck, MdCurrencyRupee,
  MdChevronRight, MdError, MdShare, MdArrowBack, MdArrowForward,
  MdPhoto, MdHome, MdCalendarToday
} from 'react-icons/md';
import {
  StarIcon as StarIconSolid, ShieldCheckIcon, CheckBadgeIcon,
  WrenchIcon, UserIcon, ClockIcon, ChevronRightIcon, CheckIcon,
  ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/Loader';
import RelatedServicesComponent from '../../components/RelatedServices';
import ErrorState from '../../components/Error';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { API, showToast, isAuthenticated } = useAuth();

  // ==================== STATE MANAGEMENT ====================
  const [service, setService] = useState(null);
  const [relatedServices, setRelatedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [openAccordion, setOpenAccordion] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [allImages, setAllImages] = useState([]);
  const [categories, setCategories] = useState([]);

  // ==================== HELPER FUNCTIONS ====================
  const formatDuration = (hours) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs === 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
  };

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
    if (typeof service.category === 'object' && service.category.name) {
      return service.category.name;
    }
    if (typeof service.category === 'string' && categories.length > 0) {
      const category = categories.find(cat => cat._id === service.category);
      return category ? category.name : 'Uncategorized';
    }
    if (typeof service.category === 'object' && service.category._id && categories.length > 0) {
      const category = categories.find(cat => cat._id === service.category._id);
      return category ? category.name : 'Uncategorized';
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
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API}/system-setting/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchServiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const serviceResponse = await fetch(`${API}/service/services/${id}`);
      const serviceData = await serviceResponse.json();

      if (!serviceResponse.ok) {
        throw new Error(serviceData.message || 'Failed to fetch service');
      }
      if (!serviceData.success || !serviceData.data) {
        throw new Error('Service not found');
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
          const relatedResponse = await fetch(`${API}/service/services/category/${categoryId}?limit=4`);
          const relatedData = await relatedResponse.json();

          if (relatedResponse.ok && relatedData.success) {
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
      const category = categories.find(cat => cat._id === relatedCategory);
      return category ? category.name : 'Uncategorized';
    }
    if (typeof relatedCategory === 'object' && relatedCategory._id && categories.length > 0) {
      const category = categories.find(cat => cat._id === relatedCategory._id);
      return category ? category.name : 'Uncategorized';
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
      state: { serviceDetails: service }
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
    fetchCategories();
  }, [API]);

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
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <nav className="flex text-sm text-gray-500 font-medium" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link to="/customer/services" className="hover:text-green-600 transition-colors flex items-center">
                <MdHome className="w-4 h-4 mr-1" />
                Home
              </Link>
            </li>
            <MdChevronRight className="w-4 h-4 text-gray-400" />
            <li>
              <button onClick={() => navigate(`/customer/services?category=${getCategoryId}`)} className="hover:text-green-600 transition-colors">
                {categoryName}
              </button>
            </li>
            <MdChevronRight className="w-4 h-4 text-gray-400" />
            <li className="text-gray-900 font-semibold truncate max-w-[200px]">
              {service.title}
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="md:grid md:grid-cols-2 gap-8 p-6 lg:p-8">

            {/* Left Column: Image Section */}
            <div className="space-y-6">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                    <LoadingSpinner />
                  </div>
                )}
                <img
                  src={allImages[currentImageIndex]}
                  alt={service.title}
                  className={`w-full h-full object-contain transition-all duration-500 group-hover:scale-105 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={handleImageLoad}
                />

                {allImages.length > 1 && (
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="p-2 rounded-full bg-white/90 shadow-md text-gray-600 hover:text-green-600 hover:bg-white transition-all">
                      <MdArrowBack size={20} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="p-2 rounded-full bg-white/90 shadow-md text-gray-600 hover:text-green-600 hover:bg-white transition-all">
                      <MdArrowForward size={20} />
                    </button>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar justify-center">
                  {allImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleThumbnailClick(index)}
                      className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all p-1 flex-shrink-0 ${index === currentImageIndex
                        ? 'border-green-600 ring-2 ring-green-100 scale-105 shadow-md'
                        : 'border-gray-100 hover:border-gray-300'
                        }`}
                    >
                      <img src={image} className="w-full h-full object-cover rounded-lg" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Service Details */}
            <div className="flex flex-col h-full mt-8 md:mt-0">
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-2">
                    {service.title}
                  </h1>

                  {/* Rating Section */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-green-50 px-2 py-1 rounded text-green-700 font-bold text-sm">
                      <MdStar className="mr-0.5" />
                      {service.averageRating?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-gray-400 text-sm font-medium border-l border-gray-200 pl-4 uppercase tracking-wider">
                      {service.ratingCount || 0} Reviews
                    </div>
                  </div>
                </div>

                {/* Price Section */}
                <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-green-700">₹{service.basePrice?.toLocaleString()}</span>
                    <span className="text-gray-400 text-lg line-through">₹{(service.basePrice * 1.2).toFixed(0)}</span>
                    <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs font-black uppercase">20% OFF</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-2 font-medium">Inclusive of all taxes • Direct Professional Service</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-gray-900 font-bold uppercase text-xs tracking-wider border-b border-gray-100 pb-2">Description</h3>
                  <p className="text-gray-600 text-[15px] leading-relaxed">
                    {service.description}
                  </p>
                </div>

                {/* Features / Special Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">What's Included</h4>
                    <ul className="space-y-2">
                      {specialNotes.map((note, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <MdCheck className="text-green-500 mt-0.5 shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Materials/Tools</h4>
                    <ul className="space-y-2">
                      {materialsUsed.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div className="mt-10 space-y-4">
                <div className="flex gap-4">
                  <button
                    onClick={handleBookNow}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <MdCalendarToday size={20} />
                    BOOK SERVICE NOW
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-all"
                  >
                    <MdShare size={24} />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-6 py-4 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-tighter">
                    <MdSecurity className="text-green-500 w-4 h-4" />
                    Secure Booking
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-tighter">
                    <MdAccessTime className="text-green-500 w-4 h-4" />
                    On-time arrival
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Bottom Section (FAQ & Reviews) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-12 min-w-max">
            {['overview', 'specifications', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-1 border-b-2 font-bold text-sm uppercase tracking-widest transition-all ${activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
              >
                {tab === 'reviews' ? `Customer Reviews (${service.ratingCount || 0})` : tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="animate-fade-in">
          {activeTab === 'overview' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-8">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 border-l-4 border-green-600 pl-4">Service Details</h3>
                  <p className="text-gray-600 leading-relaxed">{service.description}</p>
                </div>
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 border-l-4 border-green-600 pl-4">Service Guarantees</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: <ShieldCheckIcon className="w-5 h-5" />, text: "30-Day Warranty" },
                      { icon: <UserIcon className="w-5 h-5" />, text: "Certified Pros" },
                      { icon: <ClockIcon className="w-5 h-5" />, text: "On-Time Arrival" },
                      { icon: <CheckBadgeIcon className="w-5 h-5" />, text: "Genuine Spares" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="text-green-600">{item.icon}</div>
                        <span className="text-sm font-semibold text-gray-700">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specifications' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <div className="max-w-2xl divide-y divide-gray-100">
                <div className="grid grid-cols-2 py-4">
                  <span className="text-gray-500 font-medium">Estimated Duration</span>
                  <span className="text-gray-900 font-bold">{formatDuration(service.duration)}</span>
                </div>
                <div className="grid grid-cols-2 py-4">
                  <span className="text-gray-500 font-medium">Category</span>
                  <span className="text-gray-900 font-bold">{categoryName}</span>
                </div>
                <div className="grid grid-cols-2 py-4">
                  <span className="text-gray-500 font-medium">Availability</span>
                  <span className={`font-bold ${service.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {service.isActive ? 'Ready for Booking' : 'Not Available Currently'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                <div className="text-center md:text-left">
                  <div className="text-5xl font-black text-gray-900 mb-2">{service.averageRating?.toFixed(1) || '0.0'}</div>
                  <div className="flex justify-center md:justify-start items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <MdStar key={star} className={`w-5 h-5 ${star <= (service.averageRating || 0) ? 'text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <div className="text-gray-400 text-sm font-semibold uppercase">{service.ratingCount || 0} Customer Ratings</div>
                </div>
                <div className="flex-1 w-full max-w-md space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = ratingDistribution[rating];
                    const percentage = service.ratingCount > 0 ? (count / service.ratingCount) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-4 group">
                        <span className="text-xs font-bold text-gray-600 w-4">{rating}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400 w-8 text-right">{percentage.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {service.feedback?.length > 0 ? (
                  service.feedback.map((review, index) => (
                    <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                          {review.customer?.name?.[0] || 'U'}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-gray-900">{review.customer?.name || 'Customer'}</div>
                          <div className="text-[10px] uppercase font-black text-gray-400 tracking-widest">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <MdStar key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed italic">"{review.comment}"</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <ChatBubbleLeftEllipsisIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">No reviews yet for this service</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Services Section */}
      <div className="bg-gray-50/50 py-20 border-t border-gray-100 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div className="space-y-4">
              <span className="block w-12 h-1.5 bg-green-600 rounded-full"></span>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tighter">Recommended For You</h2>
            </div>
            <Link to={`/customer/services?category=${getCategoryId}`} className="text-xs font-bold uppercase tracking-widest text-green-600 hover:underline">
              Explore More
            </Link>
          </div>
          <RelatedServicesComponent
            services={relatedServices}
            categoryName={categoryName}
            categoryId={getCategoryId}
          />
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;