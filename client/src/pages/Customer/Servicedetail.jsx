import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { StarIcon, ArrowLeftIcon, ShoppingCartIcon, ClockIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { API, showToast } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchService = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/service/services/${id}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch service');
        }

        setService(data.data);
        if (data.data.providerPrices.length > 0) {
          setSelectedProvider(data.data.providerPrices[0]);
        }
      } catch (err) {
        setError(err.message);
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [id, API, showToast]);

  const handleBookNow = () => {
    if (!selectedProvider) return;
    navigate(`/book-now/${id}?provider=${selectedProvider.provider._id}`);
  };

  const handleAddToCart = () => {
    if (!selectedProvider) return;
    showToast('Service added to cart', 'success');
    // Add to cart logic here
  };

  if (error) return <div className="container mx-auto py-10 text-center text-red-500">{error}</div>;
  if (!service) return <div className="container mx-auto py-10 text-center">Service not found</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb Navigation */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <button 
                  onClick={() => navigate(-1)} 
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Services
                </button>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-sm font-medium text-gray-500">{service.category}</span>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-sm font-medium text-gray-700">{service.title}</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="md:flex">
            {/* Service Image Gallery */}
            <div className="md:w-1/2 p-6">
              <div className="relative h-96 rounded-lg overflow-hidden bg-gray-100 mb-4">
                <img
                  src={`${API}/service/uploads/services/${service.image}`}
                  alt={service.title}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `${API}/service/uploads/services/default-service.jpg`;
                  }}
                />
                {service.basePrice > (selectedProvider?.price || service.basePrice) && (
                  <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                    {Math.round((service.basePrice - (selectedProvider?.price || service.basePrice)) / service.basePrice * 100)}% OFF
                  </div>
                )}
              </div>
              
              {/* Additional images carousel */}
              <ServiceCarousel />
            </div>

            {/* Service Details */}
            <div className="md:w-1/2 p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.title}</h1>
              
              <div className="flex items-center mb-4">
                <div className="flex items-center mr-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon 
                      key={i} 
                      className={`w-5 h-5 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                  <span className="text-gray-600 ml-1">(42 reviews)</span>
                </div>
                <span className="text-green-600 text-sm font-medium flex items-center">
                  <CheckBadgeIcon className="w-4 h-4 mr-1" />
                  Verified Service
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline mb-2">
                  {selectedProvider?.price < service.basePrice ? (
                    <>
                      <span className="text-3xl font-bold text-gray-900">
                        ₹{(selectedProvider?.price || service.basePrice).toFixed(2)}
                      </span>
                      <span className="ml-2 text-lg text-gray-500 line-through">
                        ₹{service.basePrice.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">
                      ₹{service.basePrice.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex items-center text-gray-600 mb-4">
                  <ClockIcon className="w-5 h-5 mr-1" />
                  <span>{service.durationFormatted} service duration</span>
                </div>

                <p className="text-gray-700 mb-6">{service.description}</p>
              </div>

              {/* Provider Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Select Your Service Provider</h3>
                <div className="grid grid-cols-1 gap-3">
                  {service.providerPrices.map((provider) => (
                    <ProviderCard 
                      key={provider.provider._id}
                      provider={provider}
                      basePrice={service.basePrice}
                      isSelected={selectedProvider?.provider._id === provider.provider._id}
                      onSelect={() => setSelectedProvider(provider)}
                    />
                  ))}
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <div className="flex items-center">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1 border border-gray-300 rounded-l-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    -
                  </button>
                  <span className="px-4 py-1 border-t border-b border-gray-300 bg-white text-gray-900">
                    {quantity}
                  </span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1 border border-gray-300 rounded-r-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleBookNow}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-sm transition duration-150"
                >
                  Book Now
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-6 rounded-lg shadow-sm transition duration-150"
                >
                  <ShoppingCartIcon className="w-5 h-5 mr-2" />
                  Add to Cart
                </button>
              </div>

              {/* Service Highlights */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Service Highlights</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>Professional and certified service providers</li>
                  <li>Same-day service available</li>
                  <li>100% satisfaction guarantee</li>
                  <li>Transparent pricing with no hidden fees</li>
                  <li>Free re-service if issue not resolved</li>
                </ul>
              </div>
            </div>
          </div>

          {/* More Details Section */}
          <div className="mt-8 bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Service Details</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">What's Included</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Professional diagnosis of the issue</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>All necessary parts and materials</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Complete service as described</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Cleanup after service completion</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Things to Know</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Customer should provide access to the area needing service</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Additional charges may apply for parts not covered</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>Service may be rescheduled due to unforeseen circumstances</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mt-8 bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
              
              <div className="flex items-center mb-6">
                <div className="mr-4">
                  <span className="text-4xl font-bold">4.2</span>
                  <span className="text-gray-500">/5</span>
                </div>
                <div>
                  <div className="flex items-center mb-1">
                    <span className="w-16 text-sm text-gray-600">5 stars</span>
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mx-2">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">75%</span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="w-16 text-sm text-gray-600">4 stars</span>
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mx-2">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '15%' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">15%</span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="w-16 text-sm text-gray-600">3 stars</span>
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mx-2">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '5%' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">5%</span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="w-16 text-sm text-gray-600">2 stars</span>
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mx-2">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '3%' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">3%</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-16 text-sm text-gray-600">1 star</span>
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mx-2">
                      <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '2%' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">2%</span>
                  </div>
                </div>
              </div>

              {/* Sample Reviews */}
              <div className="space-y-6">
                {[1, 2, 3].map((review) => (
                  <div key={review} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 mr-3"></div>
                      <div>
                        <h4 className="font-medium">Customer {review}</h4>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon 
                              key={i} 
                              className={`w-4 h-4 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                            />
                          ))}
                          <span className="text-xs text-gray-500 ml-1">2 days ago</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700">
                      The service was excellent! The technician arrived on time and fixed my issue quickly. 
                      Very professional and knowledgeable. Would definitely recommend.
                    </p>
                  </div>
                ))}
              </div>

              <button className="mt-6 text-blue-600 font-medium hover:text-blue-800">
                View all 42 reviews
              </button>
            </div>
          </div>

          {/* Related Services */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Related Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">Service Image</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-1">Related Service {item}</h3>
                    <div className="flex items-center mb-2">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon 
                          key={i} 
                          className={`w-4 h-4 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                        />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">(12)</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-lg font-bold text-gray-900">₹{1500 + (item * 200)}</span>
                      <span className="ml-2 text-sm text-gray-500 line-through">₹{2000 + (item * 200)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;