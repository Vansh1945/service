import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBagIcon, 
  TrashIcon, 
  ArrowRightIcon,
  ShoppingCartIcon,
  SparklesIcon,
  CheckCircleIcon,
  TruckIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

const CartPage = () => {
  const { user, token, API, logout } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Fetch cart data
  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/cart`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch cart');
      }

      const data = await response.json();
      setCart(data);
    } catch (error) {
      toast.error(error.message);
      console.error('Fetch cart error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add item to cart
  const handleAddToCart = async (serviceId, quantity = 1) => {
    try {
      setUpdating(true);
      const response = await fetch(`${API}/cart/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serviceId, quantity })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add to cart');
      }

      const data = await response.json();
      setCart(data.cart);
      toast.success('Item added to cart');
    } catch (error) {
      toast.error(error.message);
      console.error('Add to cart error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Update item quantity
  const handleUpdateQuantity = async (serviceId, quantity) => {
    try {
      setUpdating(true);
      const response = await fetch(`${API}/cart/update/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update quantity');
      }

      const data = await response.json();
      setCart(data);
      toast.success('Quantity updated');
    } catch (error) {
      toast.error(error.message);
      console.error('Update quantity error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Remove item from cart
  const handleRemoveItem = async (serviceId) => {
    try {
      setUpdating(true);
      const response = await fetch(`${API}/cart/remove/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove item from cart');
      }

      const data = await response.json();
      setCart(data.cart || { items: [] });
      toast.success('Item removed from cart');
    } catch (error) {
      toast.error(error.message);
      console.error('Remove item error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Clear entire cart
  const handleClearCart = async () => {
    try {
      setUpdating(true);
      const response = await fetch(`${API}/cart/clear`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear cart');
      }

      setCart({ items: [] });
      toast.success('Cart cleared');
    } catch (error) {
      toast.error(error.message);
      console.error('Clear cart error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Calculate total
  const calculateTotal = () => {
    if (!cart || !cart.items || cart.items.length === 0) return 0;
    
    return cart.items.reduce((total, item) => {
      return total + (item.priceAtAddition * item.quantity);
    }, 0);
  };

  // Calculate total items count
  const calculateItemCount = () => {
    if (!cart || !cart.items || cart.items.length === 0) return 0;
    
    return cart.items.reduce((count, item) => {
      return count + item.quantity;
    }, 0);
  };

  // Fetch cart on component mount
  useEffect(() => {
    if (token) {
      fetchCart();
    }
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
        >
          <ShoppingCartIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h2>
          <p className="text-gray-600 mb-6">Please log in to view your cart and continue shopping.</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
          >
            Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <SparklesIcon className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-lg font-medium text-gray-700">Loading your cart...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-2xl">
              <ShoppingBagIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">My Cart</h1>
              {cart?.items?.length > 0 && (
                <p className="text-gray-600">
                  {calculateItemCount()} item{calculateItemCount() !== 1 ? 's' : ''} in your cart
                </p>
              )}
            </div>
          </div>
        </motion.div>
        
        {(!cart?.items || cart.items.length === 0) ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md mx-auto">
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCartIcon className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Your cart is empty</h3>
              <p className="text-gray-600 mb-8">Discover amazing services and add them to your cart!</p>
              <button 
                onClick={() => navigate('/services')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-8 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Explore Services
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence>
                {cart.items.map((item, index) => (
                  <motion.div
                    key={item.service._id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
                  >
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Service Image */}
                        <div className="flex-shrink-0">
                          <div className="relative w-full sm:w-24 h-48 sm:h-24 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100">
                            {item.service.image ? (
                              <img 
                                src={item.service.image} 
                                alt={item.service.title} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center" style={{ display: item.service.image ? 'none' : 'flex' }}>
                              <ShoppingBagIcon className="w-8 h-8 text-blue-500" />
                            </div>
                          </div>
                        </div>

                        {/* Service Details */}
                        <div className="flex-grow">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-xl font-bold text-gray-800 mb-1">
                                {item.service.title}
                              </h3>
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                                  {item.service.category || 'Service'}
                                </span>
                                {item.service.duration && (
                                  <span className="text-sm text-gray-500 flex items-center">
                                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                                    {item.service.duration} hrs
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.service._id)}
                              disabled={updating}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Price and Quantity */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => handleUpdateQuantity(item.service._id, item.quantity - 1)}
                                  disabled={item.quantity <= 1 || updating}
                                  className="px-3 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="px-4 py-1 text-center min-w-[40px]">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.service._id, item.quantity + 1)}
                                  disabled={updating}
                                  className="px-3 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-gray-800">
                                ₹{(item.priceAtAddition * item.quantity).toFixed(2)}
                              </div>
                              <div className="text-sm text-gray-500">
                                ₹{item.priceAtAddition.toFixed(2)} each
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Clear Cart Button */}
              {cart.items.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-4"
                >
                  <button
                    onClick={handleClearCart}
                    disabled={updating}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center space-x-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-all duration-200"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Clear entire cart</span>
                  </button>
                </motion.div>
              )}
            </div>
            
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl shadow-xl p-6 sticky top-6"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                  <SparklesIcon className="w-6 h-6 text-purple-600 mr-2" />
                  Order Summary
                </h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Subtotal ({calculateItemCount()} items)</span>
                    <span className="font-semibold text-gray-800">₹{calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Service Fee</span>
                    <span className="font-semibold text-green-600">Free</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Taxes & Charges</span>
                    <span className="font-semibold text-gray-800">₹0.00</span>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Amount</span>
                      <span className="text-2xl font-bold text-gray-800">₹{calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Service Highlights */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-700">
                      <TruckIcon className="w-4 h-4 text-blue-600 mr-2" />
                      <span>Same day service available</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <ShieldCheckIcon className="w-4 h-4 text-green-600 mr-2" />
                      <span>30-day service warranty</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-700">
                      <CheckCircleIcon className="w-4 h-4 text-purple-600 mr-2" />
                      <span>Certified professionals</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-6 rounded-2xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                  disabled={updating || !cart.items || cart.items.length === 0}
                >
                  {updating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Proceed to Checkout</span>
                      <ArrowRightIcon className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  By proceeding, you agree to our Terms & Conditions
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;