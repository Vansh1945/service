const mongoose = require('mongoose');
const { Referral, ReferralRewardLog } = require('../models/Referral-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model');

/**
 * 1. generateReferralCode()
 * Generates a unique referral code.
 */
const generateReferralCode = async (role) => {
  const { generateReferralCode: generator } = require('./generateUniqueId');
  let unique = false;
  let code = '';
  while (!unique) {
    code = generator(role);
    const userExists = await User.findOne({ referralCode: code }).select('_id');
    const providerExists = await Provider.findOne({ referralCode: code }).select('_id');
    if (!userExists && !providerExists) {
      unique = true;
    }
  }
  return code;
};

/**
 * 2. validateReferralEligibility()
 * Validates if a user is eligible to share their referral code.
 */
const validateReferralEligibility = async (user, userType, settings) => {
  const completedCount = await Booking.countDocuments({
    [userType === 'provider' ? 'provider' : 'customer']: user._id,
    status: 'completed'
  });
  const required = userType === 'provider'
    ? settings.providerReferralEligibilityBookings
    : settings.customerReferralEligibilityBookings;

  return {
    eligible: completedCount >= required,
    completedCount,
    required,
    remainingBookings: Math.max(0, required - completedCount),
    progress: required > 0 ? Math.min(100, Math.round((completedCount / required) * 100)) : 100
  };
};

/**
 * 3. validateReferralCode()
 * Validates a referral code input during signup or verification.
 */
const validateReferralCode = async (code, expectedRole, settings) => {
  if (settings.referralProgramPaused) {
    return { valid: false, message: 'Referral program is temporarily unavailable.' };
  }
  if (!code) {
    return { valid: false, message: 'Referral code is required' };
  }

  const isCustomerEnabled = settings.customerProgramEnabled;
  const isProviderEnabled = settings.providerProgramEnabled;
  let referrer = null;

  if (expectedRole === 'customer') {
    if (!isCustomerEnabled) {
      return { valid: false, message: 'Customer referral program is currently disabled' };
    }
    referrer = await User.findOne({ referralCode: code.trim(), role: 'customer', isSuspended: { $ne: true } });
  } else {
    if (!isProviderEnabled) {
      return { valid: false, message: 'Provider referral program is currently disabled' };
    }
    referrer = await Provider.findOne({ referralCode: code.trim(), isDeleted: { $ne: true } });
  }

  if (!referrer) {
    return { valid: false, message: 'Invalid or suspended Referral Code' };
  }

  const eligibility = await validateReferralEligibility(referrer, expectedRole, settings);
  if (!eligibility.eligible) {
    return {
      valid: false,
      eligible: false,
      remainingBookings: eligibility.remainingBookings,
      message: `Referrer is not eligible to share referral code. Needs ${eligibility.remainingBookings} more completed booking(s).`
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const dailyReferralsCount = await Referral.countDocuments({
    referrer: referrer._id,
    createdAt: { $gte: startOfDay }
  });
  const dailyLimit = settings.dailyReferralLimitPerUser || 5;
  if (dailyReferralsCount >= dailyLimit) {
    return { valid: false, message: `Referral code usage limit exceeded for today (limit: ${dailyLimit})` };
  }

  const monthlyReferralsCount = await Referral.countDocuments({
    referrer: referrer._id,
    createdAt: { $gte: startOfMonth }
  });
  const monthlyLimit = settings.monthlyReferralLimitPerUser || 20;
  if (monthlyReferralsCount >= monthlyLimit) {
    return { valid: false, message: `Referral code usage limit exceeded for this month (limit: ${monthlyLimit})` };
  }

  return {
    valid: true,
    eligible: true,
    referrer,
    message: `Referred by ${referrer.name}`
  };
};

/**
 * 4. checkReferralExpiry()
 * Validates expiration status and marks expired referrals.
 */
const checkReferralExpiry = async (referral) => {
  if (referral.expiryDate && new Date() > referral.expiryDate) {
    referral.status = 'expired';
    await referral.save();
    return true;
  }
  return false;
};

/**
 * 5. checkFraudFlags()
 * Checks for IP/Device/Email/Phone/Bank/UPI similarity and returns abuse flags and score.
 */
const checkFraudFlags = async (referrer, referredUser, req, type) => {
  const abuseFlags = [];
  let score = 0;

  if (referrer._id.toString() === referredUser._id.toString()) {
    abuseFlags.push('self_referral');
    score += 100;
  }

  if (referrer.email && referredUser.email && referrer.email.toLowerCase() === referredUser.email.toLowerCase()) {
    abuseFlags.push('same_email');
    score += 50;
  }

  const normRefPhone = referrer.phone ? referrer.phone.replace(/[^0-9]/g, '').slice(-10) : '';
  const normReferredPhone = referredUser.phone ? referredUser.phone.replace(/[^0-9]/g, '').slice(-10) : '';
  if (normRefPhone && normReferredPhone && normRefPhone === normReferredPhone) {
    abuseFlags.push('same_phone');
    score += 50;
  }

  if (type === 'registration') {
    const ip = req ? (req.ip || req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const deviceId = req ? req.headers['x-device-id'] : '';

    if (ip && referrer.lastLoginIp === ip) {
      abuseFlags.push('same_ip');
      score += 40;
    }

    if (deviceId && referrer.deviceIds && referrer.deviceIds.some(d => d.deviceId === deviceId)) {
      abuseFlags.push('same_device');
      score += 60;
    }
  } else if (type === 'payout') {
    if (referrer.bankDetails && referredUser.bankDetails) {
      const rAcct = referrer.bankDetails.accountNo;
      const rdAcct = referredUser.bankDetails.accountNo;
      if (rAcct && rdAcct && rAcct === rdAcct) {
        abuseFlags.push('same_bank_account');
        score += 70;
      }
    }

    if (referrer.wallet?.upiId && referredUser.wallet?.upiId && referrer.wallet.upiId === referredUser.wallet.upiId) {
      abuseFlags.push('same_upi');
      score += 70;
    }

    const ip = req ? (req.ip || req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    if (ip && referrer.lastLoginIp === ip) {
      abuseFlags.push('same_ip');
      score += 30;
    }
  }

  return { abuseFlags, score };
};

/**
 * 6. calculateCustomerReward()
 * Computes the customer referral reward amount.
 */
const calculateCustomerReward = (booking, settings) => {
  if (settings.rewardCalculationMode === 'fixed') {
    return settings.fixedRewardAmount || 50;
  }
  const rewardPercent = settings.commissionPercentage;
  return parseFloat(((booking.commissionAmount * rewardPercent) / 100).toFixed(2)) || 0;
};

/**
 * 7. calculateProviderReward()
 * Calculates provider milestone rewards.
 */
const calculateProviderReward = (commissionGenerated, settings) => {
  const rewardPercent = settings.commissionPercentage;
  return parseFloat(((commissionGenerated * rewardPercent) / 100).toFixed(2)) || 0;
};

/**
 * 8. calculateROI()
 * Calculates campaign net profits and ROI.
 */
const calculateROI = (totalReferralCommission, totalRewardsPaid, totalWelcomeRewards) => {
  const netProfit = totalReferralCommission - totalRewardsPaid - totalWelcomeRewards;
  const roi = totalRewardsPaid <= 0 ? 0 : parseFloat(((netProfit / totalRewardsPaid) * 100).toFixed(2));
  return { netProfit, roiPercentage: roi };
};

/**
 * 9. createReferralCoupon()
 * Creates and persists a referral coupon using the Coupon model.
 */
const createReferralCoupon = async (code, value, minBooking, expiryDays, assignedTo, creatorId) => {
  const coupon = new Coupon({
    code,
    discountType: 'flat',
    discountValue: value,
    minBookingValue: minBooking,
    expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
    isReferralCoupon: true,
    stackable: false,
    assignedTo,
    isActive: true,
    usageLimit: 1,
    createdBy: creatorId
  });
  await coupon.save();
  return coupon;
};

/**
 * 10. releaseReferralReward()
 * Credits wallets, records transactions, saves logs, and triggers notifications.
 */
const releaseReferralReward = async (referral, referrer, rewardAmount, booking, type) => {
  if (rewardAmount <= 0) return;

  if (!referrer.wallet) {
    referrer.wallet = { availableBalance: 0, totalRefunded: 0, walletTransactions: [], lastUpdated: new Date() };
  }
  referrer.wallet.availableBalance += rewardAmount;

  const reasonText = type === 'customer'
    ? `Referral Reward: Friend booking completed (${booking.bookingId || booking._id})`
    : `Provider referral milestone reward`;

  referrer.wallet.walletTransactions.push({
    type: 'credit',
    amount: rewardAmount,
    reason: reasonText,
    status: 'success',
    booking: booking?._id,
    createdAt: new Date()
  });
  referrer.wallet.lastUpdated = new Date();
  await referrer.save();

  const transaction = new Transaction({
    booking: booking?._id,
    bookingId: booking?.bookingId || booking?._id?.toString(),
    user: referrer._id,
    [referrer.role === 'provider' ? 'provider' : 'customer']: referrer._id,
    [referrer.role === 'provider' ? 'providerId' : 'customerId']: referrer._id.toString(),
    amount: rewardAmount,
    paymentStatus: 'completed',
    paymentMethod: 'wallet',
    type: 'referral_reward',
    description: reasonText
  });
  await transaction.save();

  try {
    const rewardLog = new ReferralRewardLog({
      referral: referral._id,
      rewardType: type === 'customer' ? 'customer_referral' : 'provider_milestone',
      recipient: referrer._id,
      recipientModel: referrer.role === 'provider' ? 'Provider' : 'User',
      recipientType: referrer.role === 'provider' ? 'provider' : 'customer',
      amount: rewardAmount,
      details: {
        bookingId: booking?._id
      },
      status: 'released'
    });
    await rewardLog.save();
    console.log(`[ReferralRewardLog] Created reward log for ${referrer._id}`);
  } catch (logErr) {
    console.error('Error saving ReferralRewardLog:', logErr);
  }

  return transaction;
};

/**
 * 11. applyProviderReferralBenefit()
 * Applies commission discount and priority onboarding parameters to referred providers.
 */
const applyProviderReferralBenefit = async (provider, settings) => {
  provider.referralBenefit = {
    commissionDiscountPercent: settings.commissionPercentage,
    validTill: new Date(Date.now() + settings.expiryDays * 24 * 60 * 60 * 1000)
  };
  provider.onboardingPriorityExpiresAt = new Date(Date.now() + settings.expiryDays * 24 * 60 * 60 * 1000);
  await provider.save();
};

/**
 * 12. checkQualifiedReferralLimit()
 * Validates daily and monthly rate limits.
 */
const checkQualifiedReferralLimit = async (referrer, settings) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const dailyCount = await Referral.countDocuments({ referrer: referrer._id, status: 'released', completedAt: { $gte: startOfDay } });
  const monthlyCount = await Referral.countDocuments({ referrer: referrer._id, status: 'released', completedAt: { $gte: startOfMonth } });

  return dailyCount >= settings.dailyQualifiedReferralLimit || monthlyCount >= settings.monthlyQualifiedReferralLimit;
};

module.exports = {
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
};
