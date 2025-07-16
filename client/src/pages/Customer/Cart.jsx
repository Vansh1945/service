import { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CartPage = () => {
  const { token, API, isAuthenticated, logoutUser } = useAuth();
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
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch cart');
      }

      const data = await response.json();
      console.log('Cart data:', data); // Debug log
      setCart(data.data?.cart || { items: [] });
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
      setCart(data.data.cart);
      toast.success('Item added to cart');
    } catch (error) {
      toast.error(error.message);
      console.error('Add to cart error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Update cart item quantity
  const handleUpdateQuantity = async (item, quantity) => {
    try {
      // Validate inputs
      if (!item || quantity < 1) {
        toast.error('Invalid quantity');
        return;
      }

      // Use the cart item's _id (not the service _id)
      const itemId = item._id;
      
      if (!itemId) {
        console.error('No valid item ID found:', item);
        toast.error('Cannot update item: Invalid item ID');
        return;
      }

      console.log('Updating item with ID:', itemId, 'to quantity:', quantity);
      
      setUpdating(true);
      const response = await fetch(`${API}/cart/update/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update cart item');
      }

      const data = await response.json();
      setCart(data.data.cart);
      toast.success('Cart updated');
    } catch (error) {
      toast.error(error.message);
      console.error('Update cart error:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Remove item from cart
  const handleRemoveItem = async (item) => {
    try {
      // Use the cart item's _id (not the service _id)
      const itemId = item._id;
      
      if (!itemId) {
        console.error('No valid item ID found:', item);
        toast.error('Cannot remove item: Invalid item ID');
        return;
      }

      console.log('Removing item with ID:', itemId);
      
      setUpdating(true);
      const response = await fetch(`${API}/cart/remove/${itemId}`, {
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
      // Handle case where cart is cleared completely
      if (data.data === null) {
        setCart({ items: [] });
      } else {
        setCart(data.data.cart || { items: [] });
      }
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

  // Calculate total using virtual field or manual calculation
  const calculateTotal = () => {
    if (!cart || !cart.items || cart.items.length === 0) return 0;
    
    // Use virtual field if available, otherwise calculate manually
    if (cart.totalPrice !== undefined) {
      return cart.totalPrice;
    }
    
    return cart.items.reduce((total, item) => {
      return total + (item.priceAtAddition * item.quantity);
    }, 0);
  };

  // Calculate total items count
  const calculateItemCount = () => {
    if (!cart || !cart.items || cart.items.length === 0) return 0;
    
    // Use virtual field if available, otherwise calculate manually
    if (cart.itemCount !== undefined) {
      return cart.itemCount;
    }
    
    return cart.items.reduce((count, item) => {
      return count + item.quantity;
    }, 0);
  };

  // Fetch cart on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Your Cart</h2>
        <p>Please log in to view your cart.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Your Cart</h2>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3">Loading your cart...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Cart</h2>
        {cart && cart.items && cart.items.length > 0 && (
          <span className="text-gray-600">
            {calculateItemCount()} item{calculateItemCount() !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {(!cart || !cart.items || cart.items.length === 0) ? (
        <div className="bg-gray-100 p-6 rounded-lg text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.68 5.18a2 2 0 00.86 2.74l6.92 3.46a2 2 0 001.8 0l6.92-3.46a2 2 0 00.86-2.74L19 13" />
            </svg>
          </div>
          <p className="text-lg mb-4">Your cart is empty</p>
          <button 
            onClick={() => window.location.href = '/services'}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Browse Services
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="divide-y divide-gray-200">
                {cart.items.map((item, index) => {
                  // Use the cart item's _id as the key
                  const itemKey = item._id || `item-${index}`;
                  
                  return (
                    <div key={itemKey} className="p-4 flex flex-col sm:flex-row gap-4">
                      <div className="flex-shrink-0">
                        {item.service?.image ? (
                          <img 
                            src={item.service.image} 
                            alt={item.service.title || 'Service'} 
                            className="w-20 h-20 object-cover rounded"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center" style={{ display: item.service?.image ? 'none' : 'flex' }}>
                          <span className="text-gray-400 text-xs">No Image</span>
                        </div>
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-medium text-lg">{item.service?.title || 'Service'}</h3>
                        <p className="text-gray-600">{item.service?.category || ''}</p>
                        {item.service?.duration && (
                          <p className="text-sm text-gray-500">Duration: {item.service.duration}</p>
                        )}
                        <p className="text-gray-800 font-medium mt-1">
                          ₹{(item.priceAtAddition || 0).toFixed(2)} × {item.quantity} = ₹{((item.priceAtAddition || 0) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-center">
                        <div className="flex items-center border rounded">
                          <button
                            onClick={() => handleUpdateQuantity(item, Math.max(1, item.quantity - 1))}
                            disabled={updating || item.quantity <= 1}
                            className="px-3 py-1 disabled:opacity-50 hover:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 min-w-[50px] text-center">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                            disabled={updating}
                            className="px-3 py-1 disabled:opacity-50 hover:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item)}
                          disabled={updating}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={handleClearCart}
                  disabled={updating}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Clear Entire Cart
                </button>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h3 className="text-lg font-medium mb-4">Order Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal ({calculateItemCount()} items)</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <span>₹0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between font-medium text-lg pt-3 border-t">
                  <span>Total</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              <button
                className="w-full mt-6 bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                disabled={updating || !cart.items || cart.items.length === 0}
              >
                {updating ? 'Processing...' : 'Proceed to Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;