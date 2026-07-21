const PaymentService = require('../services/PaymentService');


const handleWebhook = async (req, res, next) => {
  try {
    await PaymentService.handleWebhook(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.handleWebhook] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getEarningsSummary = async (req, res, next) => {
  try {
    await PaymentService.getEarningsSummary(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.getEarningsSummary] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getWeeklyMonthlyStats = async (req, res, next) => {
  try {
    await PaymentService.getWeeklyMonthlyStats(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.getWeeklyMonthlyStats] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const requestBulkWithdrawal = async (req, res, next) => {
  try {
    await PaymentService.requestBulkWithdrawal(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.requestBulkWithdrawal] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const verifyWithdrawalOTP = async (req, res, next) => {
  try {
    await PaymentService.verifyWithdrawalOTP(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.verifyWithdrawalOTP] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const downloadEarningsReport = async (req, res, next) => {
  try {
    await PaymentService.downloadEarningsReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.downloadEarningsReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const downloadWithdrawalReport = async (req, res, next) => {
  try {
    await PaymentService.downloadWithdrawalReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.downloadWithdrawalReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    await PaymentService.getAllWithdrawalRequests(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.getAllWithdrawalRequests] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const approveWithdrawalRequest = async (req, res, next) => {
  try {
    await PaymentService.approveWithdrawalRequest(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.approveWithdrawalRequest] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const rejectWithdrawalRequest = async (req, res, next) => {
  try {
    await PaymentService.rejectWithdrawalRequest(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.rejectWithdrawalRequest] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const generateWithdrawalReport = async (req, res, next) => {
  try {
    await PaymentService.generateWithdrawalReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.generateWithdrawalReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const generateProviderEarningsReport = async (req, res, next) => {
  try {
    await PaymentService.generateProviderEarningsReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.generateProviderEarningsReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getCommissionReport = async (req, res, next) => {
  try {
    await PaymentService.getCommissionReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.getCommissionReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const failedRejectedWithdrawalsReport = async (req, res, next) => {
  try {
    await PaymentService.failedRejectedWithdrawalsReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.failedRejectedWithdrawalsReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const providerLedgerReport = async (req, res, next) => {
  try {
    await PaymentService.providerLedgerReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.providerLedgerReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const earningsSummaryReport = async (req, res, next) => {
  try {
    await PaymentService.earningsSummaryReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.earningsSummaryReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const payoutHistoryReport = async (req, res, next) => {
  try {
    await PaymentService.payoutHistoryReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.payoutHistoryReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const outstandingBalanceReport = async (req, res, next) => {
  try {
    await PaymentService.outstandingBalanceReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.outstandingBalanceReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const releaseHeldEarnings = async (req, res, next) => {
  try {
    await PaymentService.releaseHeldEarnings(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.releaseHeldEarnings] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const generateComplaintReport = async (req, res, next) => {
  try {
    await PaymentService.generateComplaintReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.generateComplaintReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const generateRefundReport = async (req, res, next) => {
  try {
    await PaymentService.generateRefundReport(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.generateRefundReport] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const adminDirectPayout = async (req, res, next) => {
  try {
    await PaymentService.adminDirectPayout(req, res, next);
  } catch (error) {
    global.logger.error(`[paymentController.adminDirectPayout] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  handleWebhook,
  getEarningsSummary,
  getWeeklyMonthlyStats,
  requestBulkWithdrawal,
  verifyWithdrawalOTP,
  downloadEarningsReport,
  downloadWithdrawalReport,
  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  generateWithdrawalReport,
  generateProviderEarningsReport,
  getCommissionReport,
  failedRejectedWithdrawalsReport,
  providerLedgerReport,
  earningsSummaryReport,
  payoutHistoryReport,
  outstandingBalanceReport,
  releaseHeldEarnings,
  generateComplaintReport,
  generateRefundReport,
  adminDirectPayout
};
