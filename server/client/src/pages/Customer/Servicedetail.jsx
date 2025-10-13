import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import {
  MdStar,
  MdAccessTime,
  MdVerified,
  MdSecurity,
  MdPerson,
  MdExpandMore,
  MdCheck,
  MdCurrencyRupee,
  MdChevronRight,
  MdError,
  MdChat,
  MdPhone,
  MdBuild,
  MdFlashOn,
  MdHome,
  MdCalendarToday,
  MdShare,
  MdArrowBack,
  MdArrowForward,
  MdPhoto
} from 'react-icons/md';
import {
  StarIcon as StarIconSolid,
  ShieldCheckIcon,
  CheckBadgeIcon,
  WrenchIcon,
  UserIcon,
  ClockIcon,
  ChevronDownIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronRightIcon,
  CheckIcon,
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { API, showToast, user, isAuthenticated, token } = useAuth();

  // State management
  const [service, setService] = useState(null);
  const [relatedServices, setRelatedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [openAccordion, setOpenAccordion] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [allImages, setAllImages] = useState([]);

  // Category icons mapping
  const getCategoryIcon = (category) => {
    const icons = {
      'Electrical': MdFlashOn,
      'AC': MdBuild,
      'Appliance Repair': MdBuild,
      'Other': MdBuild
    };
    return icons[category] || MdBuild;
  };

  // Fetch service data
  const fetchServiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));

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

      // Process all images from the service
      const images = serviceDetails.images || [];
      setAllImages(images);

      // Set default image if no images available
      if (images.length === 0) {
        setAllImages(['https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']);
      }

      // Fetch related services
      try {
        const relatedResponse = await fetch(
          `${API}/service/services/category/${serviceDetails.category}?limit=4`
        );
        const relatedData = await relatedResponse.json();

        if (relatedResponse.ok && relatedData.success) {
          const filteredRelated = relatedData.data.filter(
            s => s._id !== serviceDetails._id
          );
          setRelatedServices(filteredRelated);
        }
      } catch (relatedError) {
        console.log('Failed to fetch related services:', relatedError);
      }
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchServiceData();
    }
  }, [id]);

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

  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  const nextImage = () => {
    setCurrentImageIndex(prev =>
      prev === allImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex(prev =>
      prev === 0 ? allImages.length - 1 : prev - 1
    );
  };

  const formatDuration = (hours) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);

    if (hrs === 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index);
    setImageLoading(true);
  };

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

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 font-medium">Loading service details...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MdError className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Service Not Found</h3>
          <p className="text-gray-600 mb-6">
            {error || 'The service you\'re looking for doesn\'t exist.'}
          </p>
          <button
            onClick={() => navigate('/customer/services')}
            className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  const CategoryIcon = getCategoryIcon(service.category);
  const specialNotes = service.specialNotes;
  const materialsUsed = service.materialsUsed;

  // Desktop Booking Card
  const DesktopBookingCard = (
    <div className="sticky top-8 space-y-8">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl">
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center mb-2">
            <MdCurrencyRupee className="w-8 h-8 text-gray-600" />
            <span className="text-4xl font-bold text-gray-800 ml-1">
              {service.basePrice?.toLocaleString() || '0'}
            </span>
          </div>
          <p className="text-gray-600">All inclusive pricing • No hidden charges</p>
          <p className="text-orange-500 text-sm mt-1 font-medium">
            * Material cost from local market is not included
          </p>
        </div>

        {/* Service Features */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            <MdAccessTime className="w-5 h-5 text-teal-600 mr-3" />
            <div>
              <div className="font-medium text-gray-800">Service Duration</div>
              <div className="text-sm text-gray-600">{formatDuration(service.duration)} Approx</div>
            </div>
          </div>

          <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            <MdSecurity className="w-5 h-5 text-teal-600 mr-3" />
            <div>
              <div className="font-medium text-gray-800">Service Warranty</div>
              <div className="text-sm text-gray-600">30 days comprehensive</div>
            </div>
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleBookNow}
            className="col-span-2 bg-orange-500 text-white py-4 px-6 rounded-xl font-bold hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-lg hover:shadow-xl"
          >
            <MdCalendarToday className="w-5 h-5 mr-3" />
            Book Service
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center py-2 px-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 shadow-sm"
          >
            <MdShare className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Contact Info */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-4">Need help? <Link to="/contact" className="text-teal-600 hover:text-teal-800 font-medium transition-colors duration-300">Contact us</Link></p>
        </div>
      </div>

      {/* Desktop Only - Peace of Mind Card */}
      <div className="hidden lg:block bg-white rounded-2xl p-6 border border-gray-200 shadow-xl">
        <h4 className="font-semibold text-gray-800 mb-4 text-lg flex items-center">
          <ShieldCheckIcon className="w-6 h-6 text-teal-600 mr-3" />
          Peace of Mind
        </h4>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
              <CheckIcon className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-gray-600"><strong>Expert Professionals:</strong> All our service providers are verified and trained.</span>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
              <CheckIcon className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-gray-600"><strong>Transparent Pricing:</strong> No hidden costs. What you see is what you pay.</span>
          </div>
          <div className="flex items-start">
            <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
              <CheckIcon className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-gray-600"><strong>Service Warranty:</strong> We stand by our work with a 30-day warranty.</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li>
                <button
                  onClick={() => navigate('/customer/services')}
                  className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors duration-300"
                >
                  <MdHome className="w-4 h-4 mr-2" />
                  Services
                </button>
              </li>
              <li>
                <div className="flex items-center">
                  <MdChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                  <button
                    onClick={() => navigate(`/customer/services?category=${service.category}`)}
                    className="text-sm font-medium text-gray-500 hover:text-teal-600 transition-colors duration-300"
                  >
                    {service.category}
                  </button>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <MdChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                  <span className="text-sm font-medium text-teal-600 truncate max-w-xs">
                    {service.title}
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8 p-6 lg:p-8">
            {/* Left Column - Images & Basic Info */}
            <div className="lg:col-span-2">
              {/* Enhanced Image Gallery */}
              <div className="mb-6 lg:mb-8">
                <div className="relative h-64 sm:h-80 lg:h-96 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 group">
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                    </div>
                  )}

                  {allImages.length > 0 ? (
                    <img
                      src={allImages[currentImageIndex]}
                      alt={`${service.title} - Image ${currentImageIndex + 1}`}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                      onLoad={handleImageLoad}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
                        setImageLoading(false);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <div className="text-center text-gray-600">
                        <MdPhoto className="w-16 h-16 mx-auto mb-2" />
                        <p>No images available</p>
                      </div>
                    </div>
                  )}

                  {/* Image Navigation */}
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        <MdArrowBack className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:bg-white hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        <MdArrowForward className="w-5 h-5 text-gray-600" />
                      </button>

                      {/* Image Counter */}
                      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {currentImageIndex + 1} / {allImages.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Enhanced Thumbnail Strip */}
                {allImages.length > 1 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center">
                      <MdPhoto className="w-4 h-4 mr-2" />
                      All Service Images ({allImages.length})
                    </h4>
                    <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {allImages.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => handleThumbnailClick(index)}
                          className={`flex-shrink-0 w-16 h-12 sm:w-20 sm:h-16 lg:w-24 lg:h-20 rounded-lg overflow-hidden border-2 transition-all duration-300 transform hover:scale-105 ${index === currentImageIndex
                            ? 'border-teal-500 ring-2 ring-teal-500/20 scale-105'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <img
                            src={image}
                            alt={`${service.title} - Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80';
                            }}
                          />
                          {/* Thumbnail overlay for active state */}
                          {index === currentImageIndex && (
                            <div className="absolute inset-0 bg-teal-500/20 border-2 border-teal-500 rounded-lg"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Header */}
              <div className="mb-4 lg:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="flex items-center text-xs sm:text-sm font-medium text-teal-600 bg-teal-50 px-2 sm:px-3 py-1 rounded-full border border-teal-200">
                        <CategoryIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        {service.category}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">
                      {service.title}
                    </h1>
                  </div>

                  {/* Rating Badge - Hidden on mobile, shown on desktop */}
                  <div className="hidden lg:block text-right">
                    <div className="flex items-center bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
                      <StarIconSolid className="w-5 h-5 text-yellow-400 mr-1" />
                      <span className="font-semibold text-gray-800">
                        {service.averageRating?.toFixed(1) || '0.0'}
                      </span>
                      <span className="text-gray-600 text-sm ml-1">
                        ({service.ratingCount || 0})
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-lg leading-relaxed">
                  {service.description}
                </p>

                {/* Mobile Rating - Only shown on mobile */}
                <div className="lg:hidden flex items-center mt-4">
                  <StarIconSolid className="w-5 h-5 text-yellow-400 mr-1" />
                  <span className="font-semibold text-gray-800">
                    {service.averageRating?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-gray-600 text-sm ml-1">
                    ({service.ratingCount || 0} reviews)
                  </span>
                </div>
              </div>

              {/* Mobile Booking Card */}
              <div className="lg:hidden mb-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl">
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center mb-2">
                      <MdCurrencyRupee className="w-6 h-6 text-gray-600" />
                      <span className="text-3xl font-bold text-gray-800 ml-1">
                        {service.basePrice?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <p className="text-gray-600">All inclusive pricing • No hidden charges</p>
                    <p className="text-orange-500 text-sm mt-1 font-medium">
                      * Material cost from local market is not included
                    </p>
                  </div>

                  {/* Service Features */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <MdAccessTime className="w-5 h-5 text-teal-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-800">Service Duration</div>
                        <div className="text-sm text-gray-600">{formatDuration(service.duration)} Approx</div>
                      </div>
                    </div>

                    <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <MdSecurity className="w-5 h-5 text-teal-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-800">Service Warranty</div>
                        <div className="text-sm text-gray-600">30 days comprehensive</div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Action Buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={handleBookNow}
                      className="col-span-2 bg-orange-500 text-white py-3 px-4 rounded-xl font-bold hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-lg hover:shadow-xl text-sm"
                    >
                      <MdCalendarToday className="w-4 h-4 mr-2" />
                      Book Service
                    </button>

                    <button
                      onClick={handleShare}
                      className="flex items-center justify-center py-2 px-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 shadow-sm"
                    >
                      <MdShare className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                    <p className="text-sm text-gray-600 mb-4">Need help? <Link to="/contact" className="text-teal-600 hover:text-teal-800 font-medium transition-colors duration-300">Contact us</Link></p>
                  </div>
                </div>
              </div>

              {/* Service Details Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', label: 'Service Overview' },
                    { id: 'specifications', label: 'Specifications' },
                    { id: 'reviews', label: `Reviews (${service.ratingCount || 0})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-300 ${activeTab === tab.id
                        ? 'border-teal-600 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="prose prose-lg max-w-none">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6 border border-teal-200">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center text-lg">
                          <CheckBadgeIcon className="w-6 h-6 text-teal-600 mr-3" />
                          Service Inclusions
                        </h4>
                        <ul className="text-gray-600 space-y-3">
                          {specialNotes && specialNotes.length > 0 ? specialNotes.map((note, index) => (
                            <li key={index} className="flex items-start">
                              <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                <CheckIcon className="w-3 h-3 text-white" />
                              </div>
                              <span className="pt-0.5">{note}</span>
                            </li>
                          )) : <p>No special notes available.</p>}
                        </ul>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center text-lg">
                          <WrenchIcon className="w-6 h-6 text-orange-500 mr-3" />
                          Tools & Equipment
                        </h4>
                        <ul className="text-gray-600 space-y-3">
                          {materialsUsed && materialsUsed.length > 0 ? materialsUsed.map((material, index) => (
                            <li key={index} className="flex items-start">
                              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                <CheckIcon className="w-3 h-3 text-white" />
                              </div>
                              <span className="pt-0.5">{material}</span>
                            </li>
                          )) : <p>No materials information available.</p>}
                        </ul>
                      </div>
                    </div>

                    {/* Service Benefits */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-4 text-lg">
                        Why Choose Raj Electrical Service
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex items-center p-3 bg-white/50 rounded-lg">
                          <ShieldCheckIcon className="w-5 h-5 text-teal-600 mr-3" />
                          <span className="text-gray-600">30-day service warranty</span>
                        </div>
                        <div className="flex items-center p-3 bg-white/50 rounded-lg">
                          <UserIcon className="w-5 h-5 text-teal-600 mr-3" />
                          <span className="text-gray-600">Certified electricians</span>
                        </div>
                        <div className="flex items-center p-3 bg-white/50 rounded-lg">
                          <ClockIcon className="w-5 h-5 text-teal-600 mr-3" />
                          <span className="text-gray-600">On-time service guarantee</span>
                        </div>
                        <div className="flex items-center p-3 bg-white/50 rounded-lg">
                          <CheckBadgeIcon className="w-5 h-5 text-teal-600 mr-3" />
                          <span className="text-gray-600">Quality assured work</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'specifications' && (
                  <div className="grid gap-8 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-4 text-lg">
                          Service Specifications
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-3 border-b border-gray-200">
                            <span className="font-medium text-gray-600 flex items-center">
                              <ClockIcon className="w-4 h-4 mr-2" />
                              Service Duration
                            </span>
                            <span className="text-gray-800 font-semibold bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                              {formatDuration(service.duration)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-3 border-b border-gray-200">
                            <span className="font-medium text-gray-600 flex items-center">
                              <CategoryIcon className="w-4 h-4 mr-2" />
                              Service Category
                            </span>
                            <span className="text-gray-800 font-semibold">{service.category}</span>
                          </div>

                          <div className="flex justify-between items-center py-3 border-b border-gray-200">
                            <span className="font-medium text-gray-600">Service Status</span>
                            <span className={`font-semibold px-3 py-1 rounded-full border ${service.isActive
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                              }`}>
                              {service.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center py-3">
                            <span className="font-medium text-gray-600">Total Images</span>
                            <span className="text-gray-800 font-semibold bg-teal-100 text-teal-800 px-3 py-1 rounded-full border border-teal-200">
                              {allImages.length} photos
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-3">
                      {/* FAQ Section */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <h4 className="font-semibold text-gray-800 p-6 text-lg border-b border-gray-200 bg-gray-50">
                          Frequently Asked Questions
                        </h4>
                        <div className="divide-y divide-gray-200">
                          {[
                            {
                              question: "What's included in the service cost?",
                              answer: "The service cost includes professional labor, basic materials, standard tools, and transportation. Material cost from local market is not included in the service charge."
                            },
                            {
                              question: "Do you provide service warranty?",
                              answer: "Yes, we provide a 30-day service warranty on all our electrical repairs and installations. This covers any issues arising from the service provided."
                            },
                            {
                              question: "Are your electricians certified?",
                              answer: "Yes, all our electricians are certified professionals with extensive experience in electrical services and safety protocols."
                            },
                            {
                              question: "How do I prepare for the electrical service?",
                              answer: "Ensure the service area is accessible and clear. Make sure the main power is accessible. Our professional electrician will guide you through any specific preparations needed for safety."
                            }
                          ].map((faq, index) => (
                            <div key={index} className="group">
                              <button
                                className="flex justify-between items-center w-full p-6 text-left hover:bg-gray-50 transition-colors duration-300"
                                onClick={() => toggleAccordion(index)}
                              >
                                <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
                                <ChevronDownIcon
                                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 flex-shrink-0 ${openAccordion === index ? 'transform rotate-180' : ''
                                    }`}
                                />
                              </button>
                              {openAccordion === index && (
                                <div className="px-6 pb-6 bg-gray-50">
                                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="space-y-6">
                    {/* Rating Summary */}
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                      <div className="flex flex-col lg:flex-row items-center justify-between">
                        <div className="text-center lg:text-left mb-6 lg:mb-0">
                          <div className="text-4xl font-bold text-gray-800 mb-2">
                            {service.averageRating?.toFixed(1) || '0.0'}
                          </div>
                          <div className="flex items-center justify-center lg:justify-start mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIconSolid
                                key={star}
                                className={`w-6 h-6 ${star <= (service.averageRating || 0)
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                                  }`}
                              />
                            ))}
                          </div>
                          <div className="text-sm text-gray-600">
                            Based on {service.ratingCount || 0} reviews
                          </div>
                        </div>

                        <div className="flex-1 max-w-md">
                          {[5, 4, 3, 2, 1].map((rating) => {
                            const count = ratingDistribution[rating];
                            const percentage = service.ratingCount > 0 ? (count / service.ratingCount) * 100 : 0;
                            return (
                              <div key={rating} className="flex items-center text-sm mb-2">
                                <span className="w-8 text-gray-600">{rating}</span>
                                <StarIconSolid className="w-4 h-4 text-yellow-400 mr-2" />
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-yellow-400 h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="w-12 text-gray-600 text-right">{percentage.toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Reviews List */}
                    <div className="space-y-4">
                      {service.feedback?.length > 0 ? (
                        service.feedback.slice(0, 10).map((review, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-300">
                            <div className="flex items-start mb-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-full flex items-center justify-center text-white font-semibold mr-4 flex-shrink-0">
                                <UserIcon className="w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-gray-800">
                                    {review.customer?.name || 'Anonymous User'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center mb-3">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <StarIconSolid
                                      key={star}
                                      className={`w-4 h-4 ${star <= review.rating
                                        ? 'text-yellow-400'
                                        : 'text-gray-300'
                                        }`}
                                    />
                                  ))}
                                </div>
                                {review.comment && (
                                  <p className="text-gray-600 leading-relaxed">{review.comment}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
                          <ChatBubbleLeftEllipsisIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg mb-2">No reviews yet</p>
                          <p className="text-sm">Be the first to review this service!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Desktop Booking Card */}
            <div className="hidden lg:block">
              {DesktopBookingCard}
            </div>
          </div>
        </div>

        {/* Enhanced Related Services */}
        {relatedServices.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-800">Related Services</h2>
              <button
                onClick={() => navigate(`/customer/services?category=${service.category}`)}
                className="text-teal-600 hover:text-teal-700 font-medium flex items-center transition-colors duration-300"
              >
                View all
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedServices.map((relatedService) => {
                const RelatedCategoryIcon = getCategoryIcon(relatedService.category);
                const relatedImages = relatedService.images || [];

                return (
                  <div
                    key={relatedService._id}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 group"
                    onClick={() => navigate(`/customer/services/${relatedService._id}`)}
                  >
                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                      <img
                        src={relatedImages[0] || 'https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}
                        alt={relatedService.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1581093458791-8a0a1ac4e8e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80';
                        }}
                      />
                      <div className="absolute top-3 left-3">
                        <span className="text-xs font-medium text-teal-600 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full border border-teal-200">
                          {relatedService.category}
                        </span>
                      </div>
                      {relatedImages.length > 1 && (
                        <div className="absolute top-3 right-3">
                          <span className="text-xs font-medium text-white bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
                            +{relatedImages.length - 1} more
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-teal-600 transition-colors duration-300">
                        {relatedService.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {relatedService.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline">
                          <MdCurrencyRupee className="w-4 h-4 text-gray-600" />
                          <span className="text-xl font-bold text-gray-800 ml-1">
                            {relatedService.basePrice?.toLocaleString() || '0'}
                          </span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                          <MdAccessTime className="w-3 h-3 mr-1" />
                          {formatDuration(relatedService.duration)}
                        </div>
                      </div>

                      <div className="flex items-center mt-3">
                        <MdStar className="w-4 h-4 text-yellow-400 mr-1" />
                        <span className="text-sm font-medium text-gray-800">
                          {relatedService.averageRating?.toFixed(1) || '0.0'}
                        </span>
                        <span className="text-gray-600 text-sm ml-1">
                          ({relatedService.ratingCount || 0})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDetailPage;