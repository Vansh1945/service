const mongoose = require('mongoose');
const BookingService = require('../services/BookingService');


const recalculateProviderPerformance = async (req, res, next) => {
  try {
    await BookingService.recalculateProviderPerformance(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.recalculateProviderPerformance] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const createBooking = async (req, res, next) => {
  try {
    await BookingService.createBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.createBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const confirmBooking = async (req, res, next) => {
  try {
    await BookingService.confirmBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.confirmBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    await BookingService.updateBookingStatus(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.updateBookingStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getUserBookings = async (req, res, next) => {
  try {
    await BookingService.getUserBookings(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getUserBookings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getCustomerBookings = async (req, res, next) => {
  try {
    await BookingService.getCustomerBookings(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getCustomerBookings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateBookingPayment = async (req, res, next) => {
  try {
    await BookingService.updateBookingPayment(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.updateBookingPayment] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProviderById = async (req, res, next) => {
  try {
    await BookingService.getProviderById(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getProviderById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getServiceById = async (req, res, next) => {
  try {
    await BookingService.getServiceById(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getServiceById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const payBooking = async (req, res, next) => {
  try {
    await BookingService.payBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.payBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getBooking = async (req, res, next) => {
  try {
    await BookingService.getBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    await BookingService.cancelBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.cancelBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const userUpdateBookingDateTime = async (req, res, next) => {
  try {
    await BookingService.userUpdateBookingDateTime(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.userUpdateBookingDateTime] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProviderBookingById = async (req, res, next) => {
  try {
    await BookingService.getProviderBookingById(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getProviderBookingById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getBookingsByStatus = async (req, res, next) => {
  try {
    await BookingService.getBookingsByStatus(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getBookingsByStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const acceptBooking = async (req, res, next) => {
  try {
    await BookingService.acceptBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.acceptBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const startBooking = async (req, res, next) => {
  try {
    await BookingService.startBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.startBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const rejectBooking = async (req, res, next) => {
  try {
    await BookingService.rejectBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.rejectBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const completeBooking = async (req, res, next) => {
  try {
    await BookingService.completeBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.completeBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const providerBookingReport = async (req, res, next) => {
  try {
    await BookingService.providerBookingReport(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.providerBookingReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllBookings = async (req, res, next) => {
  try {
    await BookingService.getAllBookings(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getAllBookings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getBookingDetails = async (req, res, next) => {
  try {
    await BookingService.getBookingDetails(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.getBookingDetails] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const assignProvider = async (req, res, next) => {
  try {
    await BookingService.assignProvider(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.assignProvider] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const deleteBooking = async (req, res, next) => {
  try {
    await BookingService.deleteBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.deleteBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const deleteUserBooking = async (req, res, next) => {
  try {
    await BookingService.deleteUserBooking(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.deleteUserBooking] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateBookingDateTime = async (req, res, next) => {
  try {
    await BookingService.updateBookingDateTime(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.updateBookingDateTime] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const downloadBookingReport = async (req, res, next) => {
  try {
    await BookingService.downloadBookingReport(req, res, next);
  } catch (error) {
    global.logger.error(`[BookingController.downloadBookingReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  recalculateProviderPerformance,
  createBooking,
  confirmBooking,
  updateBookingStatus,
  getUserBookings,
  getCustomerBookings,
  updateBookingPayment,
  getProviderById,
  getServiceById,
  payBooking,
  getBooking,
  cancelBooking,
  userUpdateBookingDateTime,
  getProviderBookingById,
  getBookingsByStatus,
  acceptBooking,
  startBooking,
  rejectBooking,
  completeBooking,
  providerBookingReport,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking,
  updateBookingDateTime,
  downloadBookingReport
};
