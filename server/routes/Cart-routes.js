const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cart-controller');
const {userAuthMiddleware} = require('../middlewares/User-middleware');

// Protect all cart routes
router.use(userAuthMiddleware);

// Get user's cart
router.get('/', getCart);

// Add item to cart
router.post('/items', addToCart);

// Update item quantity
router.put('/items/:serviceId', updateCartItem);

// Remove item from cart
router.delete('/items/:serviceId', removeFromCart);

// Clear cart
router.delete('/clear', clearCart);

module.exports = router;