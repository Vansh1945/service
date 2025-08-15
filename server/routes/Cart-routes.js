const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/Cart-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');

// Get user's cart
router.get('/', userAuthMiddleware, getCart);

// Add item to cart
router.post('/add', userAuthMiddleware, addToCart);

// Update item quantity
router.put('/update/:serviceId', userAuthMiddleware, updateCartItem);
router.patch('/update/:serviceId', userAuthMiddleware, updateCartItem);

// Remove item from cart
router.delete('/remove/:serviceId', userAuthMiddleware, removeFromCart);

// Clear cart
router.delete('/clear', userAuthMiddleware, clearCart);

module.exports = router;