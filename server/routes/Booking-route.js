// routes/Booking-routes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/Booking-controller');

// Middleware imports
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// USER ROUTES
router.post('/from-cart', userAuthMiddleware, bookingController.createBookingFromCart);
router.post('/', userAuthMiddleware, bookingController.createSingleBooking);
router.get('/user', userAuthMiddleware, bookingController.getUserBookings);
router.get('/user/:id', userAuthMiddleware, bookingController.getBooking);
router.patch('/user/:id/cancel', userAuthMiddleware, bookingController.cancelBooking);
router.patch('/user/:id/reschedule', userAuthMiddleware, bookingController.userUpdateBookingDateTime);

// PROVIDER ROUTES
router.get('/provider', providerAuthMiddleware, providerTestPassedMiddleware, bookingController.getProviderBookings);
router.patch('/provider/:id/accept', providerAuthMiddleware, providerTestPassedMiddleware, bookingController.acceptBooking);
router.patch('/provider/:id/complete', providerAuthMiddleware, providerTestPassedMiddleware, bookingController.completeBooking);

// ADMIN ROUTES
router.get('/admin', adminAuthMiddleware, bookingController.getAllBookings);
router.get('/admin/:id', adminAuthMiddleware, bookingController.getBookingDetails);
router.patch('/admin/:id/assign', adminAuthMiddleware, bookingController.assignProvider);
router.delete('/admin/:id', adminAuthMiddleware, bookingController.deleteBooking);
router.delete('/admin/user/:userId/booking/:bookingId', adminAuthMiddleware, bookingController.deleteUserBooking);
router.patch('/admin/:id/reschedule', adminAuthMiddleware, bookingController.updateBookingDateTime);

module.exports = router;