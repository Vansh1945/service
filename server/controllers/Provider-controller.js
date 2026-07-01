const ProviderService = require('../services/ProviderService');


const initiateRegistration = async (req, res, next) => {
  try {
    await ProviderService.initiateRegistration(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.initiateRegistration] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const completeRegistration = async (req, res, next) => {
  try {
    await ProviderService.completeRegistration(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.completeRegistration] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const loginForCompletion = async (req, res, next) => {
  try {
    await ProviderService.loginForCompletion(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.loginForCompletion] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const completeProfile = async (req, res, next) => {
  try {
    await ProviderService.completeProfile(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.completeProfile] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    await ProviderService.getProfile(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.getProfile] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const updateProviderProfile = async (req, res, next) => {
  try {
    await ProviderService.updateProviderProfile(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.updateProviderProfile] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const viewDocument = async (req, res, next) => {
  try {
    await ProviderService.viewDocument(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.viewDocument] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await ProviderService.deleteAccount(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.deleteAccount] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const permanentDeleteAccount = async (req, res, next) => {
  try {
    await ProviderService.permanentDeleteAccount(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.permanentDeleteAccount] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getDashboardData = async (req, res, next) => {
  try {
    await ProviderService.getDashboardData(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.getDashboardData] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const getAgreementPdf = async (req, res, next) => {
  try {
    await ProviderService.getAgreementPdf(req, res, next);
  } catch (error) {
    global.logger.error(`[ProviderController.getAgreementPdf] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  initiateRegistration,
  completeRegistration,
  loginForCompletion,
  completeProfile,
  getProfile,
  updateProviderProfile,
  viewDocument,
  deleteAccount,
  permanentDeleteAccount,
  getDashboardData,
  getAgreementPdf
};
