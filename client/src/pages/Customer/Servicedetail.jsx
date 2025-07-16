import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import {
  StarIcon,
  ArrowLeftIcon,
  ShoppingCartIcon,
  ClockIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  HandThumbUpIcon,
  CurrencyRupeeIcon,
  ChevronRightIcon,
  HeartIcon,
  UserIcon,
  CalendarIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { API, showToast, user, setCartCount } = useAuth();
  const [service, setService] = useState(null);
  const [relatedServices, setRelatedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Calculate total price automatically
  const totalPrice = service ? (service.basePrice * quantity) : 0;

  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the main service
        const serviceResponse = await fetch(`${API}/service/services/${id}`);
        const serviceData = await serviceResponse.json();

        if (!serviceResponse.ok) {
          throw new Error(serviceData.message || 'Failed to fetch service');
        }

        if (!serviceData.success || !serviceData.data) {
          throw new Error('Service data not available');
        }

        setService(serviceData.data);

        // Fetch related services from the same category
        const relatedResponse = await fetch(
          `${API}/service/services/category/${serviceData.data.category}`
        );
        const relatedData = await relatedResponse.json();

        if (relatedResponse.ok && relatedData.success) {
          const filteredRelated = relatedData.data.filter(
            s => s._id !== serviceData.data._id
          );
          setRelatedServices(filteredRelated.slice(0, 4));
        }
      } catch (err) {
        setError(err.message);
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchServiceData();
  }, [id, API, showToast]);

  const handleBookNow = () => {
    navigate(`/customer/book-service/${id}`, {
      state: {
        serviceId: id,
        price: totalPrice,
        duration: service.duration,
        quantity
      }
    });
  };

  const handleAddToCart = async () => {
    if (!user) {
      showToast('Please login to add services to cart', 'error');
      navigate('/login');
      return;
    }

    setIsAddingToCart(true);

    try {
      const response = await fetch(`${API}/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}` // Ensure this matches your backend expectation
        },
        body: JSON.stringify({
          serviceId: id,
          quantity: quantity
        })
      });


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add to cart');
      }

      showToast('Service added to cart successfully', 'success');
      setCartCount(prev => prev + quantity);
      navigate('/customer/cart');
    } catch (err) {
      showToast(err.message || 'Failed to add to cart', 'error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const navigateToService = (serviceId) => {
    navigate(`/customer/services/${serviceId}`);
    window.scrollTo(0, 0);
  };

  const formatDuration = (hours) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs > 0 ? `${hrs} hr` : ''} ${mins > 0 ? `${mins} min` : ''}`.trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Service Unavailable</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Service Not Found</h3>
          <p className="text-gray-600 mb-6">The service you're looking for doesn't exist or may have been removed.</p>
          <button
            onClick={() => navigate('/customer/services')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <button
                  onClick={() => navigate('/customer/services')}
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  All Services
                </button>
              </li>
              <li>
                <div className="flex items-center">
                  <ChevronRightIcon className="w-4 h-4 mx-1 text-gray-400" />
                  <button
                    onClick={() => navigate(`/customer/services?category=${service.category}`)}
                    className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    {service.category}
                  </button>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <ChevronRightIcon className="w-4 h-4 mx-1 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{service.title}</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="md:flex">
            {/* Service Image and Description */}
            <div className="md:w-1/2 p-6">
              {/* Main Image with Thumbnails */}
              <div className="relative h-96 rounded-xl overflow-hidden bg-gray-100 mb-4">
                <img
                  src={`${API}/service/uploads/services/${service.images?.[activeImage] || service.image || 'default-service.jpg'}`}
                  alt={service.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/placeholder-service.jpg';
                  }}
                />
              </div>

              {/* Image Thumbnails */}
              {service.images?.length > 1 && (
                <div className="flex space-x-2 mb-6 overflow-x-auto py-2">
                  {service.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveImage(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${activeImage === index ? 'border-blue-500' : 'border-transparent'}`}
                    >
                      <img
                        src={`${API}/service/uploads/services/${img}`}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/placeholder-service.jpg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Service Highlights */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Highlights</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <ClockIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm font-medium">{formatDuration(service.duration)}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <ShieldCheckIcon className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Guarantee</p>
                      <p className="text-sm font-medium">30 days warranty</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <UserIcon className="w-5 h-5 text-purple-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Expertise</p>
                      <p className="text-sm font-medium">Certified professionals</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <WrenchScrewdriverIcon className="w-5 h-5 text-amber-600 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Equipment</p>
                      <p className="text-sm font-medium">Professional tools</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Description</h2>
                <div className="prose prose-sm text-gray-700">
                  <p>{service.description}</p>
                  <p className="mt-3">Our certified technicians will provide a complete solution for your {service.title.toLowerCase()} needs, using only high-quality parts and materials that meet industry standards.</p>
                </div>
              </div>
            </div>

            {/* Service Details and Booking */}
            <div className="md:w-1/2 p-6 border-l border-gray-200">
              <div className="sticky top-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">{service.title}</h1>
                    <div className="flex items-center">
                      <div className="flex items-center mr-4">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-5 h-5 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                        <span className="text-gray-600 ml-1 text-sm">(0 reviews)</span>
                      </div>
                      <span className="text-green-600 text-sm font-medium flex items-center bg-green-50 px-2 py-1 rounded-full">
                        <CheckBadgeIcon className="w-4 h-4 mr-1" />
                        Verified Service
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price and Duration Section */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="text-sm text-gray-600">Service Price</span>
                      <div className="flex items-baseline">
                        <CurrencyRupeeIcon className="w-5 h-5 text-gray-600" />
                        <span className="text-3xl font-bold text-gray-900 ml-1">
                          {service.basePrice?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">Duration</span>
                      <div className="flex items-center justify-end">
                        <ClockIcon className="w-5 h-5 text-gray-600 mr-1" />
                        <span className="text-lg font-medium text-gray-900">
                          {formatDuration(service.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Inclusive of all taxes</p>
                </div>

                {/* Quantity Selector */}
                <div className="mb-6">
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center max-w-[120px]">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 border-t border-b border-gray-300 bg-white text-gray-900 text-center flex-1">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-3 py-2 border border-gray-300 rounded-r-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total Price Calculation */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Price per service</span>
                    <span className="font-medium">
                      ₹{service.basePrice?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">Total</span>
                    <span className="text-xl font-bold text-blue-600">
                      ₹{totalPrice?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <button
                    onClick={handleBookNow}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"
                  >
                    Book Now
                    <ChevronRightIcon className="w-5 h-5 ml-2" />
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    className={`flex-1 flex items-center justify-center border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-6 rounded-lg shadow-sm hover:shadow-md transition-all ${isAddingToCart ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isAddingToCart ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </>
                    ) : (
                      <>
                        <ShoppingCartIcon className="w-5 h-5 mr-2" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>

                {/* Service Benefits */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Why Choose Us?</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <div className="bg-blue-100 p-1 rounded-full mr-3">
                        <CheckBadgeIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-gray-700">Certified professionals with 5+ years experience</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 p-1 rounded-full mr-3">
                        <CheckBadgeIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-gray-700">Same-day service available</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 p-1 rounded-full mr-3">
                        <CheckBadgeIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-gray-700">100% satisfaction guarantee</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 p-1 rounded-full mr-3">
                        <CheckBadgeIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-gray-700">Transparent pricing with no hidden charges</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Information Section */}
          <div className="border-t border-gray-200 p-6">
            <div className="grid md:grid-cols-1 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Service Inclusions</h3>
                <div className="prose prose-sm text-gray-600">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Professional diagnosis of the issue</li>
                    <li>High-quality replacement parts (if needed)</li>
                    <li>Complete service as per industry standards</li>
                    <li>Testing and verification of the solution</li>
                    <li>30-day service warranty</li>
                    <li>Detailed service report</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Services Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Services</h2>
          {relatedServices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedServices.map((relatedService) => (
                <div
                  key={relatedService._id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-gray-100"
                  onClick={() => navigateToService(relatedService._id)}
                >
                  <div className="relative h-48 bg-gray-100">
                    <img
                      src={`${API}/service/uploads/services/${relatedService.images?.[0] || relatedService.image || 'default-service.jpg'}`}
                      alt={relatedService.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder-service.jpg';
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">{relatedService.category}</span>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        {formatDuration(relatedService.duration)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{relatedService.title}</h3>
                    <div className="flex items-center mb-3">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`w-4 h-4 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">(0)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline">
                        <CurrencyRupeeIcon className="w-4 h-4 text-gray-600" />
                        <span className="text-lg font-bold text-gray-800">
                          {relatedService.basePrice?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <button className="text-blue-600 text-sm font-medium hover:underline">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 text-center">
              <p className="text-gray-600">No related services found in this category.</p>
              <button
                onClick={() => navigate('/customer/services')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse All Services
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;