const express = require('express');
const router = express.Router();

const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

const referralController = require('../controllers/Referral-controller');
const {
  validateBody,
  updateReferralSettingsSchema,
  addMilestoneSchema,
  releaseHeldRewardSchema
} = require('../validation/common.validation');

// PUBLIC VERIFY ENDPOINT (used on signup forms)
router.get('/verify', referralController.verifyReferralCode);

// CUSTOMER DETAILS & ELIGIBILITY
router.get('/customer/details', userAuthMiddleware, referralController.getCustomerReferralDetails);
router.get('/customer/eligibility', userAuthMiddleware, referralController.getCustomerEligibility);

// PROVIDER DETAILS & ELIGIBILITY
router.get('/provider/details', providerAuthMiddleware, referralController.getProviderReferralDetails);
router.get('/provider/eligibility', providerAuthMiddleware, referralController.getProviderEligibility);

// ADMIN ENDPOINTS
router.get('/admin/dashboard', adminAuthMiddleware, referralController.getAdminDashboard);
router.get('/admin/settings', adminAuthMiddleware, referralController.getSettings);
router.put('/admin/settings', adminAuthMiddleware, validateBody(updateReferralSettingsSchema), referralController.updateSettings);
router.get('/admin/milestones', adminAuthMiddleware, referralController.getMilestones);
router.post('/admin/milestones', adminAuthMiddleware, validateBody(addMilestoneSchema), referralController.addMilestone);
router.delete('/admin/milestones/:id', adminAuthMiddleware, referralController.deleteMilestone);
router.get('/admin/fraud', adminAuthMiddleware, referralController.getFraudReferrals);
router.get('/admin/logs', adminAuthMiddleware, referralController.getRewardLogs);
router.post('/admin/release', adminAuthMiddleware, validateBody(releaseHeldRewardSchema), referralController.releaseHeldReward);

module.exports = router;
