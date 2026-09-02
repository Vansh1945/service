// routes/Booking-routes.js
const express = require('express');
const router = express.Router();
const bookingController = require('./booking-controller');
const { validateBody, validateParams, idParamSchema, bookingIdParamSchema, userIdParamSchema } = require('../../shared/validation/common-validation');
const { createBookingSchema, confirmBookingSchema, updateBookingStatusSchema, updateBookingPaymentSchema } = require('./booking-validation');

// Middleware imports
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../../shared/middlewares/provider-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');

// Specific role checkers
const requireCustomer = roleMiddleware(['customer']);
const requireProvider = roleMiddleware(['provider']);
const requireAdmin = roleMiddleware(['admin']);


// USER ROUTES
const { bookingLimiter, bookingCancelLimiter, providerActionLimiter, adminActionLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post('/', userAuthMiddleware, requireCustomer, bookingLimiter, preventDuplicateSubmissions(5), validateBody(createBookingSchema), bookingController.createBooking);
router.post('/confirm', userAuthMiddleware, requireCustomer, bookingLimiter, preventDuplicateSubmissions(5), validateBody(confirmBookingSchema), bookingController.confirmBooking);
router.post('/estimate', userAuthMiddleware, requireCustomer, bookingController.getPriceEstimate);
router.patch('/:id/status', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), validateBody(updateBookingStatusSchema), bookingController.updateBookingStatus);
router.get('/user', userAuthMiddleware, requireCustomer, bookingController.getUserBookings);
router.get('/customer', userAuthMiddleware, requireCustomer, bookingController.getCustomerBookings);
router.patch('/:id/payment', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), validateBody(updateBookingPaymentSchema), bookingController.updateBookingPayment);

router.post('/pay/:id', userAuthMiddleware, requireCustomer, bookingLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), bookingController.payBooking);
router.get('/providers/:id', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), bookingController.getProviderById);
router.get('/services/:id', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), bookingController.getServiceById);
router.get('/:id', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), bookingController.getBooking);
router.patch('/bookings/:id/cancel', userAuthMiddleware, requireCustomer, bookingCancelLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), bookingController.cancelBooking);
router.patch('/bookings/:id/reschedule', userAuthMiddleware, requireCustomer, validateParams(idParamSchema), bookingController.userUpdateBookingDateTime);

const { uploadComplaintImage, handleUploadErrors } = require('../../shared/middlewares/upload');

// PROVIDER ROUTES
router.get('/provider-booking/:id', providerAuthMiddleware, requireProvider, validateParams(idParamSchema), bookingController.getProviderBookingById);
router.get('/provider/status/:status', providerAuthMiddleware, requireProvider, bookingController.getBookingsByStatus);
router.patch('/provider/:id/accept', providerAuthMiddleware, requireProvider, providerActionLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), providerTestPassedMiddleware, bookingController.acceptBooking);
router.patch('/provider/:id/start', providerAuthMiddleware, requireProvider, providerActionLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), providerTestPassedMiddleware, uploadComplaintImage.array('images', 5), handleUploadErrors, bookingController.startBooking);
router.patch('/provider/:id/reject', providerAuthMiddleware, requireProvider, providerActionLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), providerTestPassedMiddleware, bookingController.rejectBooking);
router.patch('/provider/:id/complete', providerAuthMiddleware, requireProvider, providerActionLimiter, preventDuplicateSubmissions(5), validateParams(idParamSchema), providerTestPassedMiddleware, uploadComplaintImage.array('images', 5), handleUploadErrors, bookingController.completeBooking);
router.get('/provider/booking-report', providerAuthMiddleware, requireProvider, providerTestPassedMiddleware, bookingController.providerBookingReport);



// ADMIN ROUTES 
router.get('/admin/bookings', adminAuthMiddleware, requireAdmin, bookingController.getAllBookings);
router.get('/admin/sla-analytics', adminAuthMiddleware, requireAdmin, bookingController.getSlaAnalytics);
router.get('/bookings/:id', adminAuthMiddleware, requireAdmin, validateParams(idParamSchema), bookingController.getBookingDetails);
router.patch('/admin/:id/assign', adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), bookingController.assignProvider);
router.delete('/admin/:id', adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), bookingController.deleteBooking);
const { z } = require('zod');
const userBookingParamSchema = z.object({
  userId: userIdParamSchema.shape.userId,
  bookingId: bookingIdParamSchema.shape.bookingId
});

router.delete('/admin/user/:userId/booking/:bookingId', adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(userBookingParamSchema), bookingController.deleteUserBooking);
router.patch('/admin/:id/reschedule', adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), bookingController.updateBookingDateTime);
router.get('/admin/booking-report', adminAuthMiddleware, requireAdmin, bookingController.downloadBookingReport);

module.exports = router;
