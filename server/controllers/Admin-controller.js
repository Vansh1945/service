const AdminService = require('../services/AdminService');


const cancelBookingByAdmin = async (req, res, next) => {
  try {
    await AdminService.cancelBookingByAdmin(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.cancelBookingByAdmin] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const registerAdmin = async (req, res, next) => {
  try {
    await AdminService.registerAdmin(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.registerAdmin] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAdminProfile = async (req, res, next) => {
  try {
    await AdminService.getAdminProfile(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getAdminProfile] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateAdminProfile = async (req, res, next) => {
  try {
    await AdminService.updateAdminProfile(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.updateAdminProfile] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    await AdminService.deleteAdmin(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.deleteAdmin] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllAdmins = async (req, res, next) => {
  try {
    await AdminService.getAllAdmins(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getAllAdmins] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllCustomers = async (req, res, next) => {
  try {
    await AdminService.getAllCustomers(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getAllCustomers] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    await AdminService.getCustomerById(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getCustomerById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    await AdminService.updateCustomer(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.updateCustomer] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const toggleBlockCustomer = async (req, res, next) => {
  try {
    await AdminService.toggleBlockCustomer(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.toggleBlockCustomer] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    await AdminService.deleteCustomer(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.deleteCustomer] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const approveProvider = async (req, res, next) => {
  try {
    await AdminService.approveProvider(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.approveProvider] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getPendingProviders = async (req, res, next) => {
  try {
    await AdminService.getPendingProviders(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getPendingProviders] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllProviders = async (req, res, next) => {
  try {
    await AdminService.getAllProviders(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getAllProviders] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProviderDetails = async (req, res, next) => {
  try {
    await AdminService.getProviderDetails(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getProviderDetails] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    await AdminService.getDashboardStats(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardStats] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardSummary = async (req, res, next) => {
  try {
    await AdminService.getDashboardSummary(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardSummary] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardRevenue = async (req, res, next) => {
  try {
    await AdminService.getDashboardRevenue(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardRevenue] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardBookingsStatus = async (req, res, next) => {
  try {
    await AdminService.getDashboardBookingsStatus(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardBookingsStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardTopProviders = async (req, res, next) => {
  try {
    await AdminService.getDashboardTopProviders(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardTopProviders] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardPendingActions = async (req, res, next) => {
  try {
    await AdminService.getDashboardPendingActions(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardPendingActions] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardLiveStats = async (req, res, next) => {
  try {
    await AdminService.getDashboardLiveStats(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardLiveStats] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardRecentActivity = async (req, res, next) => {
  try {
    await AdminService.getDashboardRecentActivity(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardRecentActivity] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardAnalytics = async (req, res, next) => {
  try {
    await AdminService.getDashboardAnalytics(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDashboardAnalytics] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const processAdminRefund = async (req, res, next) => {
  try {
    await AdminService.processAdminRefund(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.processAdminRefund] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const rejectAdminRefund = async (req, res, next) => {
  try {
    await AdminService.rejectAdminRefund(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.rejectAdminRefund] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const togglePayoutHold = async (req, res, next) => {
  try {
    await AdminService.togglePayoutHold(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.togglePayoutHold] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getSameIPFraud = async (req, res, next) => {
  try {
    await AdminService.getSameIPFraud(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getSameIPFraud] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDeviceAbuse = async (req, res, next) => {
  try {
    await AdminService.getDeviceAbuse(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getDeviceAbuse] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getCancellationAlerts = async (req, res, next) => {
  try {
    await AdminService.getCancellationAlerts(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getCancellationAlerts] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const markFraudLogSafe = async (req, res, next) => {
  try {
    await AdminService.markFraudLogSafe(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.markFraudLogSafe] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const addFraudLogNote = async (req, res, next) => {
  try {
    await AdminService.addFraudLogNote(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.addFraudLogNote] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const suspendUserAccount = async (req, res, next) => {
  try {
    await AdminService.suspendUserAccount(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.suspendUserAccount] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getSystemLogs = async (req, res, next) => {
  try {
    await AdminService.getSystemLogs(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getSystemLogs] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getActiveSessions = async (req, res, next) => {
  try {
    await AdminService.getActiveSessions(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getActiveSessions] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const forceLogoutUser = async (req, res, next) => {
  try {
    await AdminService.forceLogoutUser(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.forceLogoutUser] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProviderAgreementPdf = async (req, res, next) => {
  try {
    await AdminService.getProviderAgreementPdf(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getProviderAgreementPdf] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProviderApprovalLetter = async (req, res, next) => {
  try {
    await AdminService.getProviderApprovalLetter(req, res, next);
  } catch (error) {
    global.logger.error(`[AdminController.getProviderApprovalLetter] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  cancelBookingByAdmin,
  registerAdmin,
  getAdminProfile,
  updateAdminProfile,
  deleteAdmin,
  getAllAdmins,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  toggleBlockCustomer,
  deleteCustomer,
  approveProvider,
  getPendingProviders,
  getAllProviders,
  getProviderDetails,
  getDashboardStats,
  getDashboardSummary,
  getDashboardRevenue,
  getDashboardBookingsStatus,
  getDashboardTopProviders,
  getDashboardPendingActions,
  getDashboardLiveStats,
  getDashboardRecentActivity,
  getDashboardAnalytics,
  processAdminRefund,
  rejectAdminRefund,
  togglePayoutHold,
  getSameIPFraud,
  getDeviceAbuse,
  getCancellationAlerts,
  markFraudLogSafe,
  addFraudLogNote,
  suspendUserAccount,
  getSystemLogs,
  getActiveSessions,
  forceLogoutUser,
  getProviderAgreementPdf,
  getProviderApprovalLetter
};
