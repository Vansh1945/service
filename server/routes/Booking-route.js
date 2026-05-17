// routes/Booking-routes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/Booking-controller');
const { validateBody } = require('../validation/common.validation');
const { createBookingSchema, confirmBookingSchema, updateBookingStatusSchema, updateBookingPaymentSchema } = require('../validation/booking.validation');

// Middleware imports
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/Role-Middleware');

// Specific role checkers
const requireCustomer = roleMiddleware(['customer']);
const requireProvider = roleMiddleware(['provider']);
const requireAdmin = roleMiddleware(['admin']);

// USER ROUTES
router.post('/', userAuthMiddleware, requireCustomer, validateBody(createBookingSchema), bookingController.createBooking);
router.post('/confirm', userAuthMiddleware, requireCustomer, validateBody(confirmBookingSchema), bookingController.confirmBooking);
router.patch('/:id/status', userAuthMiddleware, requireCustomer, validateBody(updateBookingStatusSchema), bookingController.updateBookingStatus);
router.get('/user', userAuthMiddleware, requireCustomer, bookingController.getUserBookings);
router.get('/customer', userAuthMiddleware, requireCustomer, bookingController.getCustomerBookings);
router.patch('/:id/payment', userAuthMiddleware, requireCustomer, validateBody(updateBookingPaymentSchema), bookingController.updateBookingPayment);

router.post('/pay/:id', userAuthMiddleware, requireCustomer, bookingController.payBooking);
router.get('/providers/:id', userAuthMiddleware, requireCustomer, bookingController.getProviderById);
router.get('/services/:id', userAuthMiddleware, requireCustomer, bookingController.getServiceById);
router.get('/:id', userAuthMiddleware, requireCustomer, bookingController.getBooking);
router.patch('/bookings/:id/cancel', userAuthMiddleware, requireCustomer, bookingController.cancelBooking);
router.patch('/bookings/:id/reschedule', userAuthMiddleware, requireCustomer, bookingController.userUpdateBookingDateTime);

const { uploadComplaintImage, handleUploadErrors } = require('../middlewares/upload');

// PROVIDER ROUTES
router.get('/provider-booking/:id', providerAuthMiddleware, requireProvider, bookingController.getProviderBookingById);
router.get('/provider/status/:status', providerAuthMiddleware, requireProvider, bookingController.getBookingsByStatus);
router.patch('/provider/:id/accept', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, bookingController.acceptBooking);
router.patch('/provider/:id/start', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, uploadComplaintImage.array('images', 5), handleUploadErrors, bookingController.startBooking);
router.patch('/provider/:id/reject', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, bookingController.rejectBooking);
router.patch('/provider/:id/complete', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, uploadComplaintImage.array('images', 5), handleUploadErrors, bookingController.completeBooking);
router.get('/provider/booking-report', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, bookingController.providerBookingReport);



// ADMIN ROUTES 
router.get('/admin/bookings', adminAuthMiddleware, requireAdmin, bookingController.getAllBookings);
router.get('/bookings/:id', adminAuthMiddleware, requireAdmin, bookingController.getBookingDetails);
router.patch('/admin/:id/assign', adminAuthMiddleware, requireAdmin, bookingController.assignProvider);
router.delete('/admin/:id', adminAuthMiddleware, requireAdmin, bookingController.deleteBooking);
router.delete('/admin/user/:userId/booking/:bookingId', adminAuthMiddleware, requireAdmin, bookingController.deleteUserBooking);
router.patch('/admin/:id/reschedule', adminAuthMiddleware, requireAdmin, bookingController.updateBookingDateTime);
router.get('/admin/booking-report', adminAuthMiddleware, requireAdmin, bookingController.downloadBookingReport);

module.exports = router;
