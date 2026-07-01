const ComplaintService = require('../services/ComplaintService');


const submitComplaint = async (req, res, next) => {
  try {
    await ComplaintService.submitComplaint(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.submitComplaint] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAllComplaints = async (req, res, next) => {
  try {
    await ComplaintService.getAllComplaints(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.getAllComplaints] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getMyComplaints = async (req, res, next) => {
  try {
    await ComplaintService.getMyComplaints(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.getMyComplaints] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getComplaint = async (req, res, next) => {
  try {
    await ComplaintService.getComplaint(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.getComplaint] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const resolveComplaint = async (req, res, next) => {
  try {
    await ComplaintService.resolveComplaint(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.resolveComplaint] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateComplaintStatus = async (req, res, next) => {
  try {
    await ComplaintService.updateComplaintStatus(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.updateComplaintStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const reopenComplaint = async (req, res, next) => {
  try {
    await ComplaintService.reopenComplaint(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.reopenComplaint] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getComplaintDetails = async (req, res, next) => {
  try {
    await ComplaintService.getComplaintDetails(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.getComplaintDetails] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const replyToComplaint = async (req, res, next) => {
  try {
    await ComplaintService.replyToComplaint(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.replyToComplaint] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const enrichComplaintData = async (req, res, next) => {
  try {
    await ComplaintService.enrichComplaintData(req, res, next);
  } catch (error) {
    global.logger.error(`[ComplaintController.enrichComplaintData] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  submitComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaint,
  resolveComplaint,
  updateComplaintStatus,
  reopenComplaint,
  getComplaintDetails,
  replyToComplaint,
  enrichComplaintData
};
