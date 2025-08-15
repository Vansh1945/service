const Cart = require('../models/Cart-model');
const Service = require('../models/Service-model');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.service');
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const { serviceId, quantity } = req.body;
    
    // Verify service exists and get its price
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found' 
      });
    }

    // Find or create cart for user
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Add item to cart with priceAtAddition
    await cart.addItem(serviceId, quantity, service.basePrice);
    
    res.json({
      success: true,
      cart: await cart.populate('items.service')
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    
    // Specific error for duplicate items
    if (error.message.includes('already in cart')) {
      return res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
    
    res.status(400).json({ 
      success: false,
      message: error.message || 'Failed to add to cart' 
    });
  }
};

// Update item quantity
const updateCartItem = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.updateQuantity(serviceId, quantity);
    res.json(await cart.populate('items.service'));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.removeItem(serviceId);
    res.json(await cart.populate('items.service'));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await cart.clearCart();
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};