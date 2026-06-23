const crypto = require('crypto');
const mongoose = require('mongoose');
const { Referral } = require('../models/Referral-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model');
const FraudLog = require('../models/FraudLog-model');
const { SystemConfig } = require('../models/SystemSetting');
const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');

/**
 * Bootstrap Referral Settings. Ensures default config is initialized.
 */
const bootstrapReferralSettings = async () => {
  const Admin = require('../models/Admin-model');
  let settings = await SystemConfig.findOne();
  if (!settings) {
    settings = new SystemConfig({ companyName: 'Raj Electrical Service' });
  }

  let referralOwnerId = settings.referralSettings?.systemReferralOwner;
  if (!referralOwnerId) {
    const firstAdmin = await Admin.findOne();
    if (firstAdmin) {
      referralOwnerId = firstAdmin._id;
    }
  }

  if (!settings.referralSettings || settings.referralSettings.monthlyBudget === undefined) {
    settings.referralSettings = {
      customerProgramEnabled: true,
      providerProgramEnabled: true,
      minBookingAmount: 0,
      commissionPercentage: 10,
      payoutHoldHours: 48,
      monthlyBudget: 50000,
      monthlyCapPerUser: 5000,
      dailyCapPerUser: 500,
      expiryDays: 30,
      referralExpiryDays: 90,
      fraudScoreThreshold: 50,
      programVersion: 1,
      walletUsagePercentage: 20,
      rewardCalculationMode: 'commission',
      rewardThresholdAmount: 1000,
      fixedRewardAmount: 50,
      customerReferralEligibilityBookings: 1,
      providerReferralEligibilityBookings: 1,
      dailyReferralLimitPerUser: 5,
      monthlyReferralLimitPerUser: 20,
      systemReferralOwner: referralOwnerId,
      providerMilestones: [
        { bookingsCount: 5, rewardAmount: 250, description: "5 Completed Bookings" },
        { bookingsCount: 10, rewardAmount: 500, description: "10 Completed Bookings" }
      ]
    };
    settings.markModified('referralSettings');
    await settings.save();
  } else if (settings.referralSettings.referralExpiryDays === undefined) {
    settings.referralSettings.referralExpiryDays = 90;
    settings.markModified('referralSettings');
    await settings.save();
  }
  return settings.referralSettings;
};

/* ==========================================================================
   REUSABLE BACKEND HELPERS (PHASE 3)
   ========================================================================== */
const {
  generateReferralCode,
  validateReferralEligibility,
  validateReferralCode,
  checkReferralExpiry,
  checkFraudFlags,
  calculateCustomerReward,
  calculateProviderReward,
  calculateROI,
  createReferralCoupon,
  releaseReferralReward,
  applyProviderReferralBenefit,
  checkQualifiedReferralLimit
} = require('../utils/referralHelpers');


/* ==========================================================================
   API CONTROLLERS & EXPORTS
   ========================================================================== */

/**
 * API: Verify referral code validity instantly on registration forms.
 */
const verifyReferralCode = async (req, res) => {
  try {
    const referralSettings = await bootstrapReferralSettings();
    const { code, role } = req.query;
    const result = await validateReferralCode(code, role || 'customer', referralSettings);

    if (!result.valid) {
      return res.status(200).json({
        success: false,
        eligible: result.eligible ?? false,
        remainingBookings: result.remainingBookings ?? 0,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      eligible: true,
      message: result.message,
      name: result.referrer.name
    });
  } catch (err) {
    console.error('Error verifying referral code:', err);
    res.status(500).json({ success: false, message: 'Server error verifying code' });
  }
};

/**
 * Process referral relation registration.
 */
const processReferralRegistration = async (referredUser, referredUserType, referralCode, req) => {
  try {
    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused) {
      console.log('Referral registration blocked: program is paused.');
      return null;
    }
    if (!referralCode) return null;

    const validation = await validateReferralCode(referralCode, referredUserType, refConfig);
    if (!validation.valid) {
      console.log(`Referral code validation failed: ${validation.message}`);
      return null;
    }

    const { referrer } = validation;
    const referrerType = referredUserType;

    const existingReferral = await Referral.findOne({ referredUser: referredUser._id }).select('_id');
    if (existingReferral) {
      console.log(`User ${referredUser._id} already referred`);
      return null;
    }

    const { abuseFlags, score } = await checkFraudFlags(referrer, referredUser, req, 'registration');
    const isSuspicious = score >= refConfig.fraudScoreThreshold;
    const status = isSuspicious ? 'fraud_flagged' : 'pending';

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + refConfig.referralExpiryDays);

    const source = req ? (req.body.source || req.query.source || 'manual') : 'manual';

    const referral = new Referral({
      referrer: referrer._id,
      referrerModel: referrerType === 'provider' ? 'Provider' : 'User',
      referrerType,
      referredUser: referredUser._id,
      referredUserModel: referredUserType === 'provider' ? 'Provider' : 'User',
      referredUserType,
      referralCodeUsed: referralCode,
      status,
      abuseFlags,
      fraudScore: score,
      source: ['link', 'manual', 'qr', 'whatsapp', 'other'].includes(source) ? source : 'manual',
      programVersion: refConfig.programVersion,
      rulesSnapshot: refConfig,
      expiryDate,
      deviceInfo: {
        ip: req ? (req.ip || req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '',
        deviceId: req ? req.headers['x-device-id'] : '',
        userAgent: req ? req.headers['user-agent'] : ''
      }
    });

    await referral.save();

    referredUser.referredBy = referralCode;
    await referredUser.save();

    if (referredUserType === 'customer') {
      const couponCodeStr = `REF-${referredUser._id.toString().substring(18).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await createReferralCoupon(
        couponCodeStr,
        refConfig.fixedRewardAmount,
        refConfig.minBookingAmount,
        refConfig.expiryDays,
        referredUser._id,
        refConfig.systemReferralOwner || referrer._id
      );
    } else if (referredUserType === 'provider') {
      await applyProviderReferralBenefit(referredUser, refConfig);
    }

    if (status === 'fraud_flagged') {
      const fraudLog = new FraudLog({
        ip: referral.deviceInfo.ip,
        userId: referredUser._id,
        userModel: referredUserType === 'provider' ? 'Provider' : 'User',
        role: referredUserType,
        device: referral.deviceInfo.deviceId,
        deviceDetails: { userAgent: referral.deviceInfo.userAgent },
        actionType: 'warning',
        fraudScore: score,
        riskLevel: 'HIGH',
        isFlagged: true,
        flagReason: `Registration Referral fraud: ${abuseFlags.join(', ')} (Score: ${score})`,
        status: 'pending_review'
      });
      await fraudLog.save();

      await notifyAdmins(
        'Referral Abuse Warning',
        `Referral fraud score of ${score} triggered for ${referredUser.name} using code ${referralCode}.`,
        'warning',
        null
      );
    }

    return referral;
  } catch (err) {
    console.error('Error processing referral signup:', err);
    return null;
  }
};

/**
 * Process customer referral reward on booking completion.
 */
const triggerCustomerReferralReward = async (booking) => {
  try {
    const rules = await bootstrapReferralSettings();
    if (rules.referralProgramPaused) {
      console.log('Customer referral reward blocked: program is paused.');
      return;
    }

    const customerId = booking.customer._id || booking.customer;
    const referral = await Referral.findOne({
      referredUser: customerId,
      referredUserType: 'customer',
      status: 'pending'
    });

    if (!referral) return;

    const isExpired = await checkReferralExpiry(referral);
    if (isExpired) return;

    if (referral.customerRewardReleased) {
      console.log('Customer referral reward already released.');
      return;
    }

    const minAmount = rules.minBookingAmount;
    if (booking.totalAmount < minAmount) {
      console.log(`Booking amount ${booking.totalAmount} is below min required ${minAmount}`);
      return;
    }

    const completedCount = await Booking.countDocuments({
      customer: customerId,
      status: 'completed'
    });
    if (completedCount > 1) {
      console.log(`Not first completed booking (count: ${completedCount})`);
      return;
    }

    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'success' && booking.paymentStatus !== 'escrow_hold') {
      console.log(`Booking payment is not successful (status: ${booking.paymentStatus})`);
      return;
    }

    const referrer = await User.findById(referral.referrer);
    if (!referrer || referrer.isDeleted || referrer.isSuspended) {
      console.log('Referrer inactive, deleted, or suspended');
      return;
    }

    const referredUser = await User.findById(customerId);
    if (!referredUser) {
      console.log('Referred user not found');
      return;
    }

    const limitExceeded = await checkQualifiedReferralLimit(referrer, rules);
    if (limitExceeded) {
      referral.status = 'fraud_flagged';
      referral.abuseFlags.push('rate_limit_exceeded');
      await referral.save();

      await notifyAdmins(
        'Qualified Referral Rate Limit Exceeded',
        `Referrer ${referrer.name} exceeded daily/monthly qualified limits. Held for review.`,
        'warning',
        null
      );
      return;
    }

    const { abuseFlags, score } = await checkFraudFlags(referrer, referredUser, null, 'payout');
    const totalScore = referral.fraudScore + score;
    referral.fraudScore = totalScore;
    referral.abuseFlags = Array.from(new Set([...referral.abuseFlags, ...abuseFlags]));

    const threshold = rules.fraudScoreThreshold;
    if (totalScore >= threshold) {
      referral.status = 'fraud_flagged';
      await referral.save();

      await notifyAdmins(
        'Payout Referral Abuse',
        `Fraud threshold reached at payout for referral ${referral._id}. Held for review.`,
        'warning',
        null
      );
      return;
    }

    const rewardAmount = calculateCustomerReward(booking, rules);
    if (rewardAmount <= 0) return;

    referral.customerRewardReleased = true;
    referral.status = 'released';
    referral.completedAt = new Date();
    await referral.save();

    await releaseReferralReward(referral, referrer, rewardAmount, booking, 'customer');

    if (rules.welcomeRewardEnabled && rules.welcomeRewardValue > 0) {
      const welcomeRewardValue = rules.welcomeRewardValue;
      const maxWelcomeVal = rules.maxWelcomeRewardValue;

      if (welcomeRewardValue <= maxWelcomeVal && welcomeRewardValue <= (booking.commissionAmount || 0)) {
        if (rules.welcomeRewardType === 'wallet' || rules.welcomeRewardType === 'both') {
          if (!referredUser.wallet) {
            referredUser.wallet = { availableBalance: 0, totalRefunded: 0, walletTransactions: [], lastUpdated: new Date() };
          }
          referredUser.wallet.availableBalance += welcomeRewardValue;
          referredUser.wallet.walletTransactions.push({
            type: 'credit',
            amount: welcomeRewardValue,
            reason: 'Referred Welcome Reward Credit',
            status: 'success',
            booking: booking._id,
            createdAt: new Date()
          });
          referredUser.wallet.lastUpdated = new Date();
          await referredUser.save();

          const welcomeTx = new Transaction({
            booking: booking._id,
            bookingId: booking.bookingId || booking._id.toString(),
            user: customerId,
            customerId: customerId.toString(),
            amount: welcomeRewardValue,
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
            type: 'referral_reward',
            description: 'Referred Customer Welcome Reward'
          });
          await welcomeTx.save();
        }

        if (rules.welcomeRewardType === 'coupon' || rules.welcomeRewardType === 'both') {
          const welcomeCode = `WELCOME-${customerId.toString().substring(18).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await createReferralCoupon(
            welcomeCode,
            welcomeRewardValue,
            0,
            30,
            customerId,
            rules.systemReferralOwner || referrer._id
          );
        }
      }
    }

    try {
      await sendNotification(
        referrer._id,
        'customer',
        'Referral Reward Released!',
        `Congratulations! You earned ₹${rewardAmount} because your friend completed their first booking.`,
        'wallet',
        booking._id
      );
    } catch (e) {
      console.error(e);
    }
  } catch (err) {
    console.error('Error handling customer referral reward transaction:', err);
  }
};

/**
 * Process provider milestone reward checks using commission windows.
 */
const triggerProviderReferralReward = async (referredProviderId) => {
  try {
    const sysSettings = await bootstrapReferralSettings();
    if (sysSettings.referralProgramPaused) {
      console.log('Provider referral reward blocked: program is paused.');
      return;
    }

    const referral = await Referral.findOne({
      referredUser: referredProviderId,
      referredUserType: 'provider',
      status: { $nin: ['fraud_flagged', 'expired', 'rejected'] }
    });

    if (!referral) return;

    const isExpired = await checkReferralExpiry(referral);
    if (isExpired) return;

    const milestones = sysSettings.providerMilestones || [];
    if (milestones.length === 0) return;

    const completedCount = await Booking.countDocuments({
      provider: referredProviderId,
      status: 'completed'
    });
    if (completedCount === 0) return;

    const referrer = await Provider.findById(referral.referrer);
    if (!referrer || referrer.isDeleted || referrer.isSuspended) return;

    const sortedMilestones = [...milestones].sort((a, b) => a.bookingsCount - b.bookingsCount);

    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i];
      if (completedCount < milestone.bookingsCount) continue;

      if (referral.providerRewardMilestonesReleased.includes(milestone.bookingsCount)) continue;

      const prevBookingsCount = i > 0 ? sortedMilestones[i - 1].bookingsCount : 0;
      const bookings = await Booking.find({
        provider: referredProviderId,
        status: 'completed'
      }).sort({ completedAt: 1 }).select('commissionAmount').lean();

      const windowBookings = bookings.slice(prevBookingsCount, milestone.bookingsCount);
      const commissionGenerated = windowBookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);

      const rewardAmount = calculateProviderReward(commissionGenerated, sysSettings);
      if (rewardAmount <= 0) continue;

      referral.providerRewardMilestonesReleased.push(milestone.bookingsCount);
      referral.status = 'released';
      referral.completedAt = new Date();
      await referral.save();

      await releaseReferralReward(referral, referrer, rewardAmount, bookings[bookings.length - 1], 'provider');

      try {
        await sendNotification(
          referrer._id,
          'provider',
          'Electrician Milestone Unlocked!',
          `You earned ₹${rewardAmount} as your referred partner completed ${milestone.bookingsCount} jobs!`,
          'wallet',
          null
        );
      } catch (e) {
        console.error(e);
      }
    }
  } catch (err) {
    console.error('Error handling provider referral reward:', err);
  }
};

/**
 * API: Get referral details for currently logged in customer.
 */
const getCustomerReferralDetails = async (req, res) => {
  try {
    const customerId = req.userID;
    let customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused) {
      return res.status(200).json({ success: true, paused: true, message: 'Referral program is temporarily unavailable.' });
    }

    const eligibility = await validateReferralEligibility(customer, 'customer', refConfig);
    if (eligibility.eligible && !customer.referralCode) {
      customer.referralCode = await generateReferralCode('customer');
      await customer.save();
    }

    const referrals = await Referral.find({ referrer: customerId, referrerType: 'customer' })
      .populate('referredUser', 'name email createdAt')
      .lean();

    const rewardLogs = await Transaction.find({ user: customerId, type: 'referral_reward' }).select('amount').lean();
    const releasedRewards = rewardLogs.reduce((sum, log) => sum + log.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        referralCode: customer.referralCode || null,
        referredBy: customer.referredBy || null,
        releasedRewards,
        pendingRewards: 0,
        referralsCount: referrals.length,
        eligibility,
        programRules: {
          commissionPercentage: refConfig.commissionPercentage,
          fixedRewardAmount: refConfig.fixedRewardAmount,
          rewardCalculationMode: refConfig.rewardCalculationMode,
          welcomeRewardEnabled: refConfig.welcomeRewardEnabled,
          welcomeRewardValue: refConfig.welcomeRewardValue,
          minBookingAmount: refConfig.minBookingAmount,
          referralExpiryDays: refConfig.referralExpiryDays,
          expiryDays: refConfig.expiryDays
        },
        referrals: referrals.map(ref => ({
          _id: ref._id,
          referredName: ref.referredUser?.name || 'Signup in progress',
          referredJoined: ref.referredUser?.createdAt,
          status: ref.status,
          completedAt: ref.completedAt,
          expiryDate: ref.expiryDate
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * API: Get referral details for currently logged in provider.
 */
const getProviderReferralDetails = async (req, res) => {
  try {
    const providerId = req.providerId;
    let provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused) {
      return res.status(200).json({ success: true, paused: true, message: 'Referral program is temporarily unavailable.' });
    }

    const eligibility = await validateReferralEligibility(provider, 'provider', refConfig);
    if (eligibility.eligible && !provider.referralCode) {
      provider.referralCode = await generateReferralCode('provider');
      await provider.save();
    }

    const referrals = await Referral.find({ referrer: providerId, referrerType: 'provider' })
      .populate('referredUser', 'name email createdAt')
      .lean();

    const rewardLogs = await Transaction.find({ provider: providerId, type: 'referral_reward' }).select('amount').lean();
    const totalEarnings = rewardLogs.reduce((sum, log) => sum + log.amount, 0);

    const milestones = refConfig.providerMilestones || [];
    const referralsWithProgress = [];

    for (const ref of referrals) {
      if (!ref.referredUser) continue;

      const compCount = await Booking.countDocuments({
        provider: ref.referredUser._id,
        status: 'completed'
      });

      const milestonesProgress = milestones.map(m => ({
        bookingsCount: m.bookingsCount,
        rewardAmount: m.rewardAmount,
        description: m.description,
        isUnlocked: compCount >= m.bookingsCount,
        currentValue: Math.min(compCount, m.bookingsCount)
      }));

      referralsWithProgress.push({
        _id: ref._id,
        referredName: ref.referredUser.name,
        referredJoined: ref.referredUser.createdAt,
        completedBookingsCount: compCount,
        status: ref.status,
        expiryDate: ref.expiryDate,
        milestones: milestonesProgress
      });
    }

    res.status(200).json({
      success: true,
      data: {
        referralCode: provider.referralCode || null,
        referredBy: provider.referredBy || null,
        totalEarnings,
        referralsCount: referralsWithProgress.length,
        eligibility,
        milestones,
        programRules: {
          commissionPercentage: refConfig.commissionPercentage,
          fixedRewardAmount: refConfig.fixedRewardAmount,
          rewardCalculationMode: refConfig.rewardCalculationMode,
          welcomeRewardEnabled: refConfig.welcomeRewardEnabled,
          welcomeRewardValue: refConfig.welcomeRewardValue,
          minBookingAmount: refConfig.minBookingAmount,
          referralExpiryDays: refConfig.referralExpiryDays,
          expiryDays: refConfig.expiryDays
        },
        referrals: referralsWithProgress
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * API: Get Admin referral dashboard analytics & controls
 */
const getAdminDashboard = async (req, res) => {
  try {
    const sysSettings = await bootstrapReferralSettings();
    const config = sysSettings;

    const timeRanges = {
      today: new Date(new Date().setHours(0, 0, 0, 0)),
      week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      allTime: new Date(0)
    };

    const analytics = {};
    for (const [key, dateThreshold] of Object.entries(timeRanges)) {
      const invites = await Referral.countDocuments({ createdAt: { $gte: dateThreshold } });
      const signups = invites;
      const completedReferrals = await Referral.countDocuments({ status: 'released', completedAt: { $gte: dateThreshold } });

      const funnel = {
        invites,
        signups,
        completedReferrals,
        releasedReferrals: completedReferrals
      };

      const rewardTransactions = await Transaction.find({
        type: 'referral_reward',
        createdAt: { $gte: dateThreshold }
      }).select('amount description').lean();

      let totalRewardsPaid = 0;
      let totalWelcomeRewards = 0;

      rewardTransactions.forEach(t => {
        if (t.description?.includes('Welcome')) {
          totalWelcomeRewards += t.amount;
        } else {
          totalRewardsPaid += t.amount;
        }
      });

      const qualifiedRefs = await Referral.find({
        status: 'released',
        completedAt: { $gte: dateThreshold }
      }).distinct('referredUser');

      const bookings = await Booking.find({
        customer: { $in: qualifiedRefs },
        status: 'completed'
      }).select('totalAmount commissionAmount').lean();

      const totalReferralRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalReferralCommission = bookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);

      const roiDetails = calculateROI(totalReferralCommission, totalRewardsPaid, totalWelcomeRewards);

      analytics[key] = {
        totalReferralRevenue,
        totalReferralCommission,
        totalRewardsPaid,
        totalWelcomeRewards,
        netProfit: roiDetails.netProfit,
        roiPercentage: roiDetails.roiPercentage,
        funnel
      };
    }

    const totalReferrals = await Referral.countDocuments();
    const customerReferrals = await Referral.countDocuments({ referrerType: 'customer' });
    const providerReferrals = await Referral.countDocuments({ referrerType: 'provider' });
    const completedReferrals = await Referral.countDocuments({ status: 'released' });
    const flaggedReferrals = await Referral.countDocuments({ status: 'fraud_flagged' });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalReferrals,
          customerReferrals,
          providerReferrals,
          completedReferrals,
          flaggedReferrals,
          analytics
        },
        config
      }
    });
  } catch (err) {
    console.error('Error fetching admin referral dashboard:', err);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard' });
  }
};

/**
 * API: Get referral settings
 */
const getSettings = async (req, res) => {
  try {
    const config = await bootstrapReferralSettings();
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * API: Update referral configurations.
 */
const updateSettings = async (req, res) => {
  try {
    let sysSettings = await SystemConfig.findOne();
    if (!sysSettings) {
      sysSettings = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }
    if (!sysSettings.referralSettings) {
      sysSettings.referralSettings = {};
    }

    Object.assign(sysSettings.referralSettings, req.body);
    sysSettings.markModified('referralSettings');
    await sysSettings.save();

    res.status(200).json({
      success: true,
      message: 'Configurations saved successfully',
      data: sysSettings.referralSettings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save configuration settings' });
  }
};

/**
 * API: Get milestones list
 */
const getMilestones = async (req, res) => {
  try {
    const sysSettings = await SystemConfig.findOne();
    const milestones = sysSettings?.referralSettings?.providerMilestones || [];
    res.status(200).json({ success: true, data: milestones });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching milestones' });
  }
};

/**
 * API: Add milestone target
 */
const addMilestone = async (req, res) => {
  try {
    const { bookingsCount, rewardAmount, description } = req.body;
    let sysSettings = await SystemConfig.findOne();
    if (!sysSettings) {
      sysSettings = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }
    if (!sysSettings.referralSettings) {
      sysSettings.referralSettings = { providerMilestones: [] };
    }

    sysSettings.referralSettings.providerMilestones.push({
      bookingsCount: Number(bookingsCount),
      rewardAmount: Number(rewardAmount),
      description
    });

    sysSettings.markModified('referralSettings');
    await sysSettings.save();

    res.status(200).json({
      success: true,
      message: 'Milestone added successfully',
      data: sysSettings.referralSettings.providerMilestones
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add milestone' });
  }
};

/**
 * API: Delete milestone target
 */
const deleteMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    let sysSettings = await SystemConfig.findOne();
    if (!sysSettings || !sysSettings.referralSettings?.providerMilestones) {
      return res.status(404).json({ success: false, message: 'Milestones not found' });
    }

    sysSettings.referralSettings.providerMilestones = sysSettings.referralSettings.providerMilestones.filter(
      m => m._id.toString() !== id
    );

    sysSettings.markModified('referralSettings');
    await sysSettings.save();

    res.status(200).json({ success: true, message: 'Milestone deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete milestone' });
  }
};

/**
 * API: Get flagged fraud referrals
 */
const getFraudReferrals = async (req, res) => {
  try {
    const fraudList = await Referral.find({ status: 'fraud_flagged' })
      .populate('referrer', 'name email phone')
      .populate('referredUser', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: fraudList });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching fraud' });
  }
};

/**
 * API: Get reward logs
 */
const getRewardLogs = async (req, res) => {
  try {
    const logs = await Transaction.find({ type: 'referral_reward' })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * API: Manual release of flagged or held referral reward.
 */
const releaseHeldReward = async (req, res) => {
  try {
    const { referralId } = req.body;
    const referral = await Referral.findById(referralId);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    referral.status = 'released';
    referral.completedAt = new Date();
    await referral.save();

    res.status(200).json({ success: true, message: 'Reward manually released successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error manually releasing' });
  }
};

/**
 * API: Get referral eligibility for currently logged in customer.
 */
const getCustomerEligibility = async (req, res) => {
  try {
    const customerId = req.userID;
    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused) {
      return res.status(200).json({ success: true, paused: true, message: 'Referral program is temporarily unavailable.' });
    }

    const customer = await User.findById(customerId).select('_id');
    const eligibility = await validateReferralEligibility(customer, 'customer', refConfig);

    res.status(200).json({
      success: true,
      data: eligibility
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * API: Get referral eligibility for currently logged in provider.
 */
const getProviderEligibility = async (req, res) => {
  try {
    const providerId = req.providerId;
    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused) {
      return res.status(200).json({ success: true, paused: true, message: 'Referral program is temporarily unavailable.' });
    }

    const provider = await Provider.findById(providerId).select('_id');
    const eligibility = await validateReferralEligibility(provider, 'provider', refConfig);

    res.status(200).json({
      success: true,
      data: eligibility
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  // Reusable helpers exported for access
  generateReferralCode,
  validateReferralEligibility,
  validateReferralCode,
  checkReferralExpiry,
  checkFraudFlags,
  calculateCustomerReward,
  calculateProviderReward,
  calculateROI,
  createReferralCoupon,
  releaseReferralReward,
  applyProviderReferralBenefit,
  checkQualifiedReferralLimit,

  // Route handler controllers
  verifyReferralCode,
  processReferralRegistration,
  triggerCustomerReferralReward,
  triggerProviderReferralReward,
  getCustomerReferralDetails,
  getProviderReferralDetails,
  getAdminDashboard,
  getSettings,
  updateSettings,
  getMilestones,
  addMilestone,
  deleteMilestone,
  getFraudReferrals,
  getRewardLogs,
  releaseHeldReward,
  getCustomerEligibility,
  getProviderEligibility
};
