const crypto = require('crypto');
const mongoose = require('mongoose');
const { Referral, ReferralRewardLog } = require('./referral-model');
const User = require('../user/user-model');
const Provider = require('../provider/provider-model');
const Booking = require('../booking/booking-model');
const Coupon = require('../coupon/coupon-model');
const Transaction = require('../payment/transaction-model');
const FraudLog = require('../fraud/fraud-log-model');
const { SystemConfig } = require('../system-setting/system-setting-model');
const { sendNotification, notifyAdmins } = require('../notification/notification-helper');

/**
 * Bootstrap Referral Settings. Ensures default config is initialized.
 */
const bootstrapReferralSettings = async () => {
  const Admin = require('../admin/admin-model');
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
  checkQualifiedReferralLimit,
  isBookingSettled
} = require('./referral-helpers');


/* ==========================================================================
   API CONTROLLERS & EXPORTS
   ========================================================================== */

/**
 * API: Verify referral code validity instantly on registration forms.
 */
const verifyReferralCode = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.verifyReferralCode] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
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
        ip: req ? (req.clientIp || req.ip || '').trim() : '',
        deviceId: req ? req.headers['x-device-id'] : '',
        userAgent: req ? req.headers['user-agent'] : ''
      }
    });

    await referral.save();

    referredUser.referredBy = referralCode;
    await referredUser.save();

    if (referredUserType === 'customer') {
      const couponCodeStr = `REF_${referredUser._id.toString().substring(18).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
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
    global.logger.error('Error processing referral signup: ' + err.message, err);
    return null;
  }
};

/**
 * Process customer referral reward on booking completion.
 */
const triggerCustomerReferralReward = async (booking) => {
  try {
    const rules = await bootstrapReferralSettings();
    
    // Check separate customer program enable/pause controls
    if (rules.customerReferralEnabled === false || rules.customerProgramEnabled === false) {
      console.log('Customer referral reward blocked: customerReferralEnabled is disabled.');
      return;
    }
    if (rules.customerReferralPaused || rules.referralProgramPaused) {
      console.log('Customer referral reward blocked: customer referral is paused.');
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

    const minAmount = rules.customerMinimumBookingAmount ?? rules.minBookingAmount ?? 0;
    if (booking.totalAmount < minAmount) {
      console.log(`Booking amount ${booking.totalAmount} is below min customer required ${minAmount}`);
      return;
    }

    const completedCount = await Booking.countDocuments({
      customer: customerId,
      status: 'completed'
    });
    if (rules.firstBookingRequired !== false && completedCount > 1) {
      console.log(`Not first completed booking (count: ${completedCount})`);
      return;
    }

    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'success' && booking.paymentStatus !== 'escrowhold') {
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

    // Platform Customer Monthly Budget Check
    const effectiveMonthlyBudget = rules.customerMonthlyBudget ?? rules.monthlyBudget;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlySpendRes = await ReferralRewardLog.aggregate([
      { $match: { status: 'released', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlySpend = monthlySpendRes[0]?.total || 0;
    if (effectiveMonthlyBudget && (monthlySpend + rewardAmount) > effectiveMonthlyBudget) {
      referral.status = 'fraud_flagged';
      referral.abuseFlags.push('platform_monthly_budget_exceeded');
      await referral.save();
      await notifyAdmins(
        'Platform Referral Monthly Budget Exceeded',
        `Customer referral reward for booking ${booking.bookingId || booking._id} rejected: Monthly budget of ₹${effectiveMonthlyBudget} reached.`,
        'critical',
        booking._id
      );
      return;
    }

    // Referrer Customer Daily Cap Check
    const effectiveDailyCap = rules.customerDailyRewardCap ?? rules.dailyCapPerUser;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dailyEarningsRes = await ReferralRewardLog.aggregate([
      { $match: { recipient: referrer._id, status: 'released', createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const dailyEarnings = dailyEarningsRes[0]?.total || 0;
    if (effectiveDailyCap && (dailyEarnings + rewardAmount) > effectiveDailyCap) {
      referral.status = 'fraud_flagged';
      referral.abuseFlags.push('user_daily_cap_exceeded');
      await referral.save();
      await notifyAdmins(
        'User Customer Referral Daily Cap Exceeded',
        `Referrer ${referrer.name} hit daily cap of ₹${effectiveDailyCap}. Held for review.`,
        'warning',
        booking._id
      );
      return;
    }

    // Referrer Customer Monthly Cap Check
    const effectiveMonthlyCap = rules.customerMonthlyRewardCap ?? rules.monthlyCapPerUser;
    const monthlyEarningsRes = await ReferralRewardLog.aggregate([
      { $match: { recipient: referrer._id, status: 'released', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlyEarnings = monthlyEarningsRes[0]?.total || 0;
    if (effectiveMonthlyCap && (monthlyEarnings + rewardAmount) > effectiveMonthlyCap) {
      referral.status = 'fraud_flagged';
      referral.abuseFlags.push('user_monthly_cap_exceeded');
      await referral.save();
      await notifyAdmins(
        'User Customer Referral Monthly Cap Exceeded',
        `Referrer ${referrer.name} hit monthly cap of ₹${effectiveMonthlyCap}. Held for review.`,
        'warning',
        booking._id
      );
      return;
    }

    referral.customerRewardReleased = true;
    referral.status = 'released';
    referral.completedAt = new Date();
    await referral.save();

    // Deliver Referrer Reward (CASH vs COUPON)
    const rewardTypeSelection = rules.customerReferrerRewardType || 'CASH';
    if (rewardTypeSelection === 'COUPON') {
      const couponCfg = rules.customerReferrerCouponConfig || {};
      const couponCode = `REF_CUST_${referrer._id.toString().slice(-6).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await createReferralCoupon(
        couponCode,
        couponCfg.discountValue || rewardAmount,
        couponCfg.minBookingAmount || 0,
        couponCfg.validityDays || 30,
        referrer._id,
        rules.systemReferralOwner || referrer._id,
        {
          discountType: couponCfg.discountType || 'flat',
          maxDiscount: couponCfg.maxDiscount || couponCfg.discountValue || rewardAmount,
          usageLimit: couponCfg.usageLimit || 1
        }
      );
      console.log(`[ReferralController] Referrer customer coupon ${couponCode} issued to ${referrer._id}`);
    } else {
      // CASH Reward to Referrer Wallet
      await releaseReferralReward(referral, referrer, rewardAmount, booking, 'customer');
    }

    // Deliver New Customer Reward (if triggered on FIRST_COMPLETED_BOOKING)
    if (
      rules.newCustomerRewardEnabled !== false &&
      (rules.newCustomerRewardTrigger || 'FIRST_COMPLETED_BOOKING') === 'FIRST_COMPLETED_BOOKING'
    ) {
      const newCustRewardVal = rules.newCustomerRewardAmount ?? rules.welcomeRewardValue ?? 50;
      const newCustRewardType = rules.newCustomerRewardType || 'CASH';

      if (newCustRewardVal > 0) {
        if (newCustRewardType === 'CASH') {
          if (!referredUser.wallet) {
            referredUser.wallet = { availableBalance: 0, totalRefunded: 0, walletTransactions: [], lastUpdated: new Date() };
          }
          referredUser.wallet.availableBalance += newCustRewardVal;
          referredUser.wallet.walletTransactions.push({
            type: 'credit',
            amount: newCustRewardVal,
            reason: 'New Customer Referral Welcome Reward',
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
            amount: newCustRewardVal,
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
            type: 'referralreward',
            description: 'New Customer Referral Welcome Reward'
          });
          await welcomeTx.save();
        } else if (newCustRewardType === 'COUPON') {
          const newCustCfg = rules.newCustomerCouponConfig || {};
          const welcomeCode = `WELCOME_${customerId.toString().slice(-6).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
          await createReferralCoupon(
            welcomeCode,
            newCustCfg.discountValue || newCustRewardVal,
            newCustCfg.minBookingAmount || 0,
            newCustCfg.validityDays || 30,
            customerId,
            rules.systemReferralOwner || referrer._id,
            {
              discountType: newCustCfg.discountType || 'flat',
              maxDiscount: newCustCfg.maxDiscount || newCustCfg.discountValue || newCustRewardVal,
              usageLimit: newCustCfg.usageLimit || 1
            }
          );
        }
      }
    }

    try {
      await sendNotification({
        userId: referrer._id,
        role: 'customer',
        title: 'Referral Reward Released!',
        message: `Congratulations! You earned your referral reward because your friend completed their first booking.`,
        type: 'wallet',
        referenceId: booking._id,
        eventId: 'referral_reward_released',
        idempotencyKey: `referral_reward_released:${referrer._id}:${booking._id}`
      });
    } catch (e) {
      global.logger.error('Error sending customer referral notification: ' + e.message, e);
    }
  } catch (err) {
    global.logger.error('Error handling customer referral reward transaction: ' + err.message, err);
  }
};

/**
 * Process provider milestone reward checks using commission windows.
 */
const triggerProviderReferralReward = async (referredProviderId) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    session = null;
  }

  try {
    const sysSettings = await bootstrapReferralSettings();
    if (sysSettings.referralProgramPaused) {
      console.log('Provider referral reward blocked: program is paused.');
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    const referral = await Referral.findOne({
      referredUser: referredProviderId,
      referredUserType: 'provider',
      status: { $nin: ['fraud_flagged', 'expired', 'rejected'] }
    }).session(session);

    if (!referral) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    const isExpired = await checkReferralExpiry(referral);
    if (isExpired) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    const milestones = sysSettings.providerMilestones || [];
    if (milestones.length === 0) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    // Get all completed, paid, non-cancelled/refunded bookings for the referee provider
    // Sorted deterministically by completion date, then _id
    const eligibleBookings = await Booking.find({
      provider: referredProviderId,
      status: 'completed',
      paymentStatus: { $in: ['paid', 'settled'] }
    }).sort({ completedAt: 1, _id: 1 }).session(session).lean();

    if (eligibleBookings.length === 0) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    const referrer = await Provider.findById(referral.referrer).session(session);
    if (!referrer || referrer.isDeleted || referrer.isSuspended) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    const sortedMilestones = [...milestones].sort((a, b) => a.bookingsCount - b.bookingsCount);

    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i];
      if (eligibleBookings.length < milestone.bookingsCount) continue;

      // 1. Identify the exact bookings contributing to this milestone window
      const prevBookingsCount = i > 0 ? sortedMilestones[i - 1].bookingsCount : 0;
      const windowBookings = eligibleBookings.slice(prevBookingsCount, milestone.bookingsCount);
      const lastBooking = windowBookings[windowBookings.length - 1];

      // Check if we already created a log for this milestone (released or held)
      let rewardLog = await ReferralRewardLog.findOne({
        referral: referral._id,
        rewardType: 'providermilestone',
        'details.milestoneBookingsCount': milestone.bookingsCount
      }).session(session);

      if (rewardLog && rewardLog.status === 'released') {
        continue;
      }

      // Calculate reward amount
      let rewardAmount = 0;
      if (sysSettings.rewardCalculationMode === 'fixed' || sysSettings.rewardCalculationMode === 'cashincentive') {
        rewardAmount = milestone.rewardAmount || 0;
      } else {
        // commission or commissionshare mode
        // Calculate based strictly on platform commission (commissionAmount) of bookings in this milestone window
        const commissionGenerated = windowBookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);
        rewardAmount = calculateProviderReward(commissionGenerated, sysSettings);
      }

      if (rewardAmount <= 0) continue;

      if (!rewardLog) {
        // Budget & cap checks before creating log or releasing
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthlySpendRes = await ReferralRewardLog.aggregate([
          { $match: { status: 'released', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).session(session);
        const monthlySpend = monthlySpendRes[0]?.total || 0;
        if (sysSettings.monthlyBudget && (monthlySpend + rewardAmount) > sysSettings.monthlyBudget) {
          referral.status = 'fraud_flagged';
          referral.abuseFlags.push('platform_monthly_budget_exceeded');
          await referral.save({ session });
          await notifyAdmins(
            'Platform Referral Monthly Budget Exceeded',
            `Provider referral milestone reward for provider ${referrer.name} rejected: Monthly budget of ₹${sysSettings.monthlyBudget} reached.`,
            'critical',
            null
          );
          continue;
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const dailyEarningsRes = await ReferralRewardLog.aggregate([
          { $match: { recipient: referrer._id, status: 'released', createdAt: { $gte: startOfDay } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).session(session);
        const dailyEarnings = dailyEarningsRes[0]?.total || 0;
        if (sysSettings.dailyCapPerUser && (dailyEarnings + rewardAmount) > sysSettings.dailyCapPerUser) {
          referral.status = 'fraud_flagged';
          referral.abuseFlags.push('user_daily_cap_exceeded');
          await referral.save({ session });
          await notifyAdmins(
            'User Referral Daily Cap Exceeded',
            `Referrer ${referrer.name} hit daily cap of ₹${sysSettings.dailyCapPerUser} during milestone reward. Held for review.`,
            'warning',
            null
          );
          continue;
        }

        const monthlyEarningsRes = await ReferralRewardLog.aggregate([
          { $match: { recipient: referrer._id, status: 'released', createdAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).session(session);
        const monthlyEarnings = monthlyEarningsRes[0]?.total || 0;
        if (sysSettings.monthlyCapPerUser && (monthlyEarnings + rewardAmount) > sysSettings.monthlyCapPerUser) {
          referral.status = 'fraud_flagged';
          referral.abuseFlags.push('user_monthly_cap_exceeded');
          await referral.save({ session });
          await notifyAdmins(
            'User Referral Monthly Cap Exceeded',
            `Referrer ${referrer.name} hit monthly cap of ₹${sysSettings.monthlyCapPerUser} during milestone reward. Held for review.`,
            'warning',
            null
          );
          continue;
        }

        rewardLog = new ReferralRewardLog({
          referral: referral._id,
          rewardType: 'providermilestone',
          recipient: referrer._id,
          recipientModel: 'Provider',
          recipientType: 'provider',
          amount: rewardAmount,
          details: {
            bookingId: lastBooking?._id,
            milestoneBookingsCount: milestone.bookingsCount
          },
          status: 'held'
        });
        await rewardLog.save({ session });
        console.log(`[ReferralRewardLog] Created held reward log for provider milestone ${milestone.bookingsCount}`);
      }

      // Check if all bookings in the milestone window are settled
      let allSettled = true;
      for (const b of windowBookings) {
        const settled = await isBookingSettled(b._id, referredProviderId, session);
        if (!settled) {
          allSettled = false;
          break;
        }
      }

      if (allSettled) {
        if (!referral.providerRewardMilestonesReleased.includes(milestone.bookingsCount)) {
          referral.providerRewardMilestonesReleased.push(milestone.bookingsCount);
          referral.status = 'released';
          referral.completedAt = new Date();
          await referral.save({ session });
        }

        await releaseReferralReward(referral, referrer, rewardAmount, lastBooking, 'provider', milestone.bookingsCount, session);

        try {
          await sendNotification({
            userId: referrer._id,
            role: 'provider',
            title: 'Electrician Milestone Unlocked!',
            message: `You earned ₹${rewardAmount} as your referred partner completed ${milestone.bookingsCount} jobs!`,
            type: 'wallet',
            referenceId: referral._id,
            eventId: 'referral_milestone_achieved',
            idempotencyKey: `referral_milestone_achieved:${referrer._id}:${referral._id}:${milestone.bookingsCount}`
          });
        } catch (e) {
          global.logger.error('Error sending milestone notification: ' + e.message, e);
        }
      }
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    global.logger.error('Error handling provider referral reward: ' + err.message, err);
  }
};

/**
 * API: Get referral details for currently logged in customer.
 */
const getCustomerReferralDetails = async (req, res, next) => {
  try {
    const customerId = req.userID;
    let customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const refConfig = await bootstrapReferralSettings();
    if (refConfig.customerReferralPaused || refConfig.customerReferralEnabled === false) {
      return res.status(200).json({ success: true, paused: true, message: 'Customer Referral program is temporarily unavailable.' });
    }

    const eligibility = await validateReferralEligibility(customer, 'customer', refConfig);
    if (eligibility.eligible && !customer.referralCode) {
      customer.referralCode = await generateReferralCode('customer');
      await customer.save();
    }

    const [referrals, rewardLogs] = await Promise.all([
      Referral.find({ referrer: customerId, referrerType: 'customer' })
        .populate('referredUser', 'name email createdAt')
        .lean(),
      ReferralRewardLog.find({ recipient: customerId, status: 'released' }).select('amount').lean()
    ]);

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
          customerReferrerRewardType: refConfig.customerReferrerRewardType || 'CASH',
          customerReferrerRewardAmount: refConfig.customerReferrerRewardAmount || 100,
          customerReferrerCouponConfig: refConfig.customerReferrerCouponConfig || { discountType: 'flat', discountValue: 100, minBookingAmount: 300 },
          newCustomerRewardEnabled: refConfig.newCustomerRewardEnabled ?? true,
          newCustomerRewardType: refConfig.newCustomerRewardType || 'CASH',
          newCustomerRewardAmount: refConfig.newCustomerRewardAmount || 50,
          newCustomerCouponConfig: refConfig.newCustomerCouponConfig || { discountType: 'flat', discountValue: 50, minBookingAmount: 200 },
          minBookingAmount: refConfig.customerMinimumBookingAmount || refConfig.minBookingAmount || 100,
          referralExpiryDays: refConfig.customerRewardValidityDays || refConfig.referralExpiryDays || 30,
          expiryDays: refConfig.expiryDays || 30
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
    global.logger.error(`[ReferralController.getCustomerReferralDetails] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get referral details for currently logged in provider.
 */
const getProviderReferralDetails = async (req, res, next) => {
  try {
    const providerId = req.providerId;
    let provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const refConfig = await bootstrapReferralSettings();
    if (refConfig.referralProgramPaused || refConfig.providerProgramEnabled === false) {
      return res.status(200).json({ success: true, paused: true, message: 'Provider Referral program is temporarily unavailable.' });
    }

    const eligibility = await validateReferralEligibility(provider, 'provider', refConfig);
    if (eligibility.eligible && !provider.referralCode) {
      provider.referralCode = await generateReferralCode('provider');
      await provider.save();
    }

    const [referrals, releasedLogs, heldLogs] = await Promise.all([
      Referral.find({ referrer: providerId, referrerType: 'provider' })
        .populate('referredUser', 'name email createdAt')
        .lean(),
      ReferralRewardLog.find({ recipient: providerId, status: 'released' }).select('amount referral rewardType details status').lean(),
      ReferralRewardLog.find({ recipient: providerId, status: 'held' }).select('amount referral rewardType details status').lean()
    ]);

    const totalEarnings = releasedLogs.reduce((sum, log) => sum + log.amount, 0);
    const pendingEarnings = heldLogs.reduce((sum, log) => sum + log.amount, 0);

    const milestones = refConfig.providerMilestones || [];
    const referralsWithProgress = [];

    // Batch count booking completions to avoid N+1 queries
    const referredUserIds = referrals
      .map(ref => ref.referredUser?._id)
      .filter(Boolean);

    const bookingCounts = referredUserIds.length > 0 ? await Booking.aggregate([
      {
        $match: {
          provider: { $in: referredUserIds },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      }
    ]) : [];

    const countMap = {};
    bookingCounts.forEach(c => {
      countMap[c._id.toString()] = c.count;
    });

    for (const ref of referrals) {
      if (!ref.referredUser) continue;

      const compCount = countMap[ref.referredUser._id.toString()] || 0;

      const milestonesProgress = milestones.map(m => {
        const isUnlocked = compCount >= m.bookingsCount;
        const rewardLog = [...releasedLogs, ...heldLogs].find(
          log => log.referral?.toString() === ref._id.toString() &&
                 log.rewardType === 'providermilestone' &&
                 log.details?.milestoneBookingsCount === m.bookingsCount
        );
        const rewardStatus = rewardLog ? rewardLog.status : (isUnlocked ? 'pending_settlement' : 'locked');
        return {
          bookingsCount: m.bookingsCount,
          rewardAmount: rewardLog?.amount ?? m.rewardAmount,
          description: m.description,
          isUnlocked,
          rewardStatus,
          currentValue: Math.min(compCount, m.bookingsCount)
        };
      });

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
        pendingEarnings,
        referralsCount: referralsWithProgress.length,
        eligibility,
        milestones,
        programRules: {
          commissionPercentage: refConfig.commissionPercentage || 10,
          fixedRewardAmount: refConfig.fixedRewardAmount || 50,
          rewardCalculationMode: refConfig.rewardCalculationMode || 'commission',
          providerCommissionDiscountPercent: refConfig.providerCommissionDiscountPercent || 10,
          providerCommissionDiscountLimitBookings: refConfig.providerCommissionDiscountLimitBookings || 5,
          providerCommissionDiscountMaxBenefit: refConfig.providerCommissionDiscountMaxBenefit || 1000,
          minBookingAmount: refConfig.minBookingAmount || 100,
          referralExpiryDays: refConfig.referralExpiryDays || 90,
          expiryDays: refConfig.expiryDays || 90
        },
        referrals: referralsWithProgress
      }
    });
  } catch (err) {
    global.logger.error(`[ReferralController.getProviderReferralDetails] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get Admin referral dashboard analytics & controls
 */
const getAdminDashboard = async (req, res, next) => {
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
        type: 'referralreward',
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
    const providerCompletedReferrals = await Referral.countDocuments({ status: 'released', referrerType: 'provider' });
    const customerCompletedReferrals = await Referral.countDocuments({ status: 'released', referrerType: 'customer' });

    const flaggedReferrals = await Referral.countDocuments({ status: 'fraud_flagged' });
    const providerFlaggedReferrals = await Referral.countDocuments({ status: 'fraud_flagged', referrerType: 'provider' });
    const customerFlaggedReferrals = await Referral.countDocuments({ status: 'fraud_flagged', referrerType: 'customer' });

    const pendingReferrals = await Referral.countDocuments({ status: 'pending' });
    const providerPendingReferrals = await Referral.countDocuments({ status: 'pending', referrerType: 'provider' });
    const customerPendingReferrals = await Referral.countDocuments({ status: 'pending', referrerType: 'customer' });

    const rewardLogsReleased = await ReferralRewardLog.aggregate([
      { $match: { status: 'released' } },
      { $group: { _id: '$recipientType', total: { $sum: '$amount' } } }
    ]);
    const providerReleasedRewards = rewardLogsReleased.find(r => r._id === 'provider')?.total || 0;
    const customerReleasedRewards = rewardLogsReleased.find(r => r._id === 'customer')?.total || 0;

    const rewardLogsHeld = await ReferralRewardLog.aggregate([
      { $match: { status: 'held' } },
      { $group: { _id: '$recipientType', total: { $sum: '$amount' } } }
    ]);
    const providerPendingRewards = rewardLogsHeld.find(r => r._id === 'provider')?.total || 0;
    const customerPendingRewards = rewardLogsHeld.find(r => r._id === 'customer')?.total || 0;

    const providerQualifiedRefs = await Referral.find({ status: 'released', referrerType: 'provider' }).distinct('referredUser');
    const customerQualifiedRefs = await Referral.find({ status: 'released', referrerType: 'customer' }).distinct('referredUser');

    const providerBookings = await Booking.find({ provider: { $in: providerQualifiedRefs }, status: 'completed' }).select('totalAmount commissionAmount').lean();
    const customerBookings = await Booking.find({ customer: { $in: customerQualifiedRefs }, status: 'completed' }).select('totalAmount commissionAmount').lean();

    const providerReferredRevenue = providerBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const customerReferredRevenue = customerBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const providerCommissionCollected = providerBookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);

    const providerFinancialSummary = {
      platformCommissionGenerated: providerCommissionCollected,
      referralRewardsReleased: providerReleasedRewards,
      companyRetainedCommission: providerCommissionCollected - providerReleasedRewards,
      referredRevenue: providerReferredRevenue
    };

    const customerFinancialSummary = {
      customerReferralMarketingSpend: customerReleasedRewards,
      cashRewards: customerReleasedRewards,
      couponRewards: 0,
      totalCustomerReferralCost: customerReleasedRewards,
      referredRevenue: customerReferredRevenue
    };

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalReferrals,
          customerReferrals,
          providerReferrals,
          completedReferrals,
          providerCompletedReferrals,
          customerCompletedReferrals,
          flaggedReferrals,
          providerFlaggedReferrals,
          customerFlaggedReferrals,
          pendingReferrals,
          providerPendingReferrals,
          customerPendingReferrals,
          providerReleasedRewards,
          customerReleasedRewards,
          providerPendingRewards,
          customerPendingRewards,
          providerReferredRevenue,
          customerReferredRevenue,
          providerFinancialSummary,
          customerFinancialSummary,
          analytics
        },
        config
      }
    });
  } catch (err) {
    global.logger.error(`[ReferralController.getAdminDashboard] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get referral settings
 */
const getSettings = async (req, res, next) => {
  try {
    const config = await bootstrapReferralSettings();
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    global.logger.error(`[ReferralController.getSettings] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Update referral configurations.
 */
const updateSettings = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.updateSettings] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get milestones list
 */
const getMilestones = async (req, res, next) => {
  try {
    const sysSettings = await SystemConfig.findOne();
    const milestones = sysSettings?.referralSettings?.providerMilestones || [];
    res.status(200).json({ success: true, data: milestones });
  } catch (err) {
    global.logger.error(`[ReferralController.getMilestones] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Add milestone target
 */
const addMilestone = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.addMilestone] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Delete milestone target
 */
const deleteMilestone = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.deleteMilestone] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get admin referrals list with filtering
 */
const getAdminReferralsList = async (req, res, next) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type && type !== 'all') filter.referrerType = type;
    if (status && status !== 'all') filter.status = status;

    const refSettings = await bootstrapReferralSettings();

    const rawList = await Referral.find(filter)
      .populate('referrer', 'name email phone referralCode providerReferralCode customerReferralCode')
      .populate('referredUser', 'name email phone createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const referralIds = rawList.map(r => r._id);
    const rewardLogs = referralIds.length > 0 ? await ReferralRewardLog.find({ referral: { $in: referralIds } }).lean() : [];

    const rewardLogMap = {};
    rewardLogs.forEach(log => {
      if (log.status === 'released') {
        rewardLogMap[log.referral.toString()] = log;
      }
    });

    const enrichedList = rawList.map(r => {
      const isCustomer = r.referrerType === 'customer';
      const snap = r.rulesSnapshot || refSettings;
      const referralCode = r.referralCodeUsed || r.referralCode || (isCustomer ? r.referrer?.customerReferralCode : r.referrer?.providerReferralCode) || r.referrer?.referralCode || 'N/A';
      
      let rewardType = 'CASH';
      let referrerBenefit = '';
      let referredUserBenefit = '';

      if (isCustomer) {
        rewardType = r.rewardType || snap?.customerReferrerRewardType || 'CASH';
        const isCoupon = rewardType === 'COUPON';
        const referrerVal = r.rewardAmount || snap?.customerReferrerRewardAmount || 100;
        const newCustVal = snap?.newCustomerRewardAmount || 50;
        const refCouponCfg = snap?.customerReferrerCouponConfig;
        const newCustCouponCfg = snap?.newCustomerCouponConfig;

        if (isCoupon) {
          const couponValStr = refCouponCfg?.discountType === 'percentage' 
            ? `${refCouponCfg.discountValue}%` 
            : `₹${refCouponCfg?.discountValue || referrerVal}`;
          const minBk = refCouponCfg?.minBookingAmount || snap?.customerMinimumBookingAmount || 100;
          referrerBenefit = `₹${referrerVal} Coupon (${couponValStr} Off, Min ₹${minBk})`;
        } else {
          referrerBenefit = `₹${referrerVal} Wallet Cash`;
        }

        if (snap?.newCustomerRewardType === 'COUPON') {
          const newCouponValStr = newCustCouponCfg?.discountType === 'percentage'
            ? `${newCustCouponCfg.discountValue}%`
            : `₹${newCustCouponCfg?.discountValue || newCustVal}`;
          const newMinBk = newCustCouponCfg?.minBookingAmount || 100;
          referredUserBenefit = `₹${newCustVal} Coupon (${newCouponValStr} Off, Min ₹${newMinBk})`;
        } else {
          referredUserBenefit = `₹${newCustVal} Welcome Cash Credit`;
        }
      } else {
        const isFixed = (snap?.rewardCalculationMode || 'commission') === 'fixed';
        rewardType = isFixed ? 'FIXED CASH' : 'COMMISSION SHARE';
        const commPercent = snap?.commissionPercentage || 10;
        const fixedAmt = snap?.fixedRewardAmount || 50;
        const discPercent = snap?.providerCommissionDiscountPercent || 10;
        const discLimit = snap?.providerCommissionDiscountLimitBookings || 5;
        const discCap = snap?.providerCommissionDiscountMaxBenefit || 1000;

        referrerBenefit = isFixed ? `₹${fixedAmt} Cash Reward / Job` : `${commPercent}% Platform Commission Share`;
        referredUserBenefit = `${discPercent}% Comm Discount (First ${discLimit} Jobs, Max ₹${discCap})`;
      }

      const releasedLog = rewardLogMap[r._id.toString()];

      return {
        ...r,
        referralCode,
        rewardType,
        referrerBenefit,
        referredUserBenefit,
        actualPaidAmount: releasedLog ? releasedLog.amount : (r.status === 'released' ? (r.rewardAmount || 0) : 0)
      };
    });

    res.status(200).json({ success: true, data: enrichedList });
  } catch (err) {
    global.logger.error(`[ReferralController.getAdminReferralsList] Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get flagged fraud referrals
 */
const getFraudReferrals = async (req, res, next) => {
  try {
    const { program, role } = req.query;
    const filter = { status: 'fraud_flagged' };
    if (program && program !== 'all') filter.referrerType = program;
    if (role && role !== 'all') filter.referredUserType = role;

    const fraudList = await Referral.find(filter)
      .populate('referrer', 'name email phone')
      .populate('referredUser', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: fraudList });
  } catch (err) {
    global.logger.error(`[ReferralController.getFraudReferrals] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get reward logs
 */
const getRewardLogs = async (req, res, next) => {
  try {
    const { program, status, recipientType } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (recipientType && recipientType !== 'all') filter.recipientType = recipientType;

    const logs = await ReferralRewardLog.find(filter)
      .populate('recipient')
      .populate({
        path: 'referral',
        populate: [
          { path: 'referrer', select: 'name email phone' },
          { path: 'referredUser', select: 'name email phone' }
        ]
      })
      .sort({ createdAt: -1 })
      .lean();

    let filteredLogs = logs;
    if (program && program !== 'all') {
      filteredLogs = logs.filter(l => l.referral?.referrerType === program || l.recipientType === program);
    }

    res.status(200).json({ success: true, data: filteredLogs });
  } catch (err) {
    global.logger.error(`[ReferralController.getRewardLogs] Route: ${req.originalUrl || req.url} - getRewardLogs error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Manual release of flagged or held referral reward.
 */
const releaseHeldReward = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.releaseHeldReward] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get referral eligibility for currently logged in customer.
 */
const getCustomerEligibility = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.getCustomerEligibility] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

/**
 * API: Get referral eligibility for currently logged in provider.
 */
const getProviderEligibility = async (req, res, next) => {
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
    global.logger.error(`[ReferralController.getProviderEligibility] Route: ${req.originalUrl || req.url} - Error: ${err.message}`, err);
    next(err);
  }
};

const releaseSettledReferralRewards = async () => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    session = null;
  }

  try {
    // Find all held provider milestone reward logs
    const heldLogs = await ReferralRewardLog.find({
      rewardType: 'providermilestone',
      status: 'held'
    }).populate('referral').session(session);

    if (heldLogs.length === 0) {
      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
      return;
    }

    console.log(`[ReferralController] releaseSettledReferralRewards: checking ${heldLogs.length} held logs...`);

    for (const log of heldLogs) {
      const referral = log.referral;
      if (!referral || ['fraud_flagged', 'expired', 'rejected'].includes(referral.status)) continue;

      const referredProviderId = referral.referredUser;
      const milestoneCount = log.details?.milestoneBookingsCount;
      if (!milestoneCount) continue;

      // Find the milestone configuration to find previous milestones
      const sysSettings = await bootstrapReferralSettings();
      const milestones = sysSettings.providerMilestones || [];
      const sortedMilestones = [...milestones].sort((a, b) => a.bookingsCount - b.bookingsCount);
      const milestoneIndex = sortedMilestones.findIndex(m => m.bookingsCount === milestoneCount);
      if (milestoneIndex === -1) continue;

      const prevBookingsCount = milestoneIndex > 0 ? sortedMilestones[milestoneIndex - 1].bookingsCount : 0;

      // Fetch all eligible bookings up to this milestone
      const eligibleBookings = await Booking.find({
        provider: referredProviderId,
        status: 'completed',
        paymentStatus: { $in: ['paid', 'settled'] }
      }).sort({ completedAt: 1, _id: 1 }).session(session).lean();

      if (eligibleBookings.length < milestoneCount) {
        console.log(`[ReferralController] Milestone ${milestoneCount} bookings count dropped to ${eligibleBookings.length} below required.`);
        continue;
      }

      // Check the exact booking window for this milestone
      const windowBookings = eligibleBookings.slice(prevBookingsCount, milestoneCount);
      let allSettled = true;
      for (const b of windowBookings) {
        const settled = await isBookingSettled(b._id, referredProviderId, session);
        if (!settled) {
          allSettled = false;
          break;
        }
      }

      if (allSettled) {
        const referrer = await Provider.findById(referral.referrer).session(session);
        if (!referrer || referrer.isDeleted || referrer.isSuspended) continue;

        if (!referral.providerRewardMilestonesReleased.includes(milestoneCount)) {
          referral.providerRewardMilestonesReleased.push(milestoneCount);
          referral.status = 'released';
          referral.completedAt = new Date();
          await referral.save({ session });
        }

        const lastBooking = windowBookings[windowBookings.length - 1];
        await releaseReferralReward(referral, referrer, log.amount, lastBooking, 'provider', milestoneCount, session);

        try {
          await sendNotification(
            referrer._id,
            'provider',
            'Electrician Milestone Unlocked!',
            `You earned ₹${log.amount} as your referred partner completed ${milestoneCount} jobs!`,
            'wallet',
            null
          );
        } catch (e) {
          global.logger.error('Error sending milestone notification: ' + e.message, e);
        }
      }
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    global.logger.error('Error releasing settled referral rewards: ' + err.message, err);
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
  isBookingSettled,
  releaseSettledReferralRewards,

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
  getAdminReferralsList,
  getCustomerEligibility,
  getProviderEligibility
};

