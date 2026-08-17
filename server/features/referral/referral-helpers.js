const mongoose = require('mongoose');
const { Referral, ReferralRewardLog } = require('./referral-model');
const User = require('../user/user-model');
const Provider = require('../provider/provider-model');
const Booking = require('../booking/booking-model');
const Coupon = require('../coupon/coupon-model');
const Transaction = require('../payment/transaction-model');

/**
 * 1. generateReferralCode()
 * Generates a unique referral code.
 */
const generateReferralCode = async (role) => {
  const { generateReferralCode: generator } = require('../../shared/utils/generate-unique-id');
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
  if (settings.customerReferrerRewardAmount && settings.customerReferrerRewardAmount > 0) {
    return settings.customerReferrerRewardAmount;
  }
  if (settings.rewardCalculationMode === 'fixed') {
    return settings.fixedRewardAmount || 50;
  }
  const rewardPercent = settings.commissionPercentage || 10;
  return parseFloat((((booking.commissionAmount || 0) * rewardPercent) / 100).toFixed(2)) || 0;
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
const createReferralCoupon = async (code, value, minBooking, expiryDays, assignedTo, creatorId, options = {}) => {
  const coupon = new Coupon({
    code,
    discountType: options.discountType || 'flat',
    discountValue: value,
    maxDiscountAmount: options.maxDiscount || value,
    minBookingValue: minBooking,
    expiryDate: new Date(Date.now() + (expiryDays || 30) * 24 * 60 * 60 * 1000),
    isReferralCoupon: true,
    stackable: false,
    assignedTo,
    isActive: true,
    usageLimit: options.usageLimit || 1,
    createdBy: creatorId
  });
  await coupon.save();
  return coupon;
};

/**
 * 10. releaseReferralReward()
 * Credits wallets, records transactions, saves logs, and triggers notifications.
 */
const releaseReferralReward = async (referral, referrer, rewardAmount, booking, type, milestoneCount, session) => {
  if (rewardAmount <= 0) return;

  const ReferralRewardLog = mongoose.model('ReferralRewardLog');
  
  // Calculate remaining cap per referral
  const sysSettings = await bootstrapReferralSettings();
  const maxCap = sysSettings.maxRewardPerReferral || 1000;
  
  const releasedLogs = await ReferralRewardLog.find({
    referral: referral._id,
    status: 'released'
  }).session(session).lean();
  const totalReleased = releasedLogs.reduce((sum, log) => sum + log.amount, 0);
  
  let finalReward = rewardAmount;
  if (type === 'provider') {
    if (totalReleased >= maxCap) {
      console.log(`[ReferralReward] Referral cap of ₹${maxCap} reached for referral ${referral._id}`);
      return;
    }
    if (totalReleased + rewardAmount > maxCap) {
      finalReward = Math.max(0, maxCap - totalReleased);
    }
  }
  
  if (finalReward <= 0) return;

  // Atomically update ReferralRewardLog status from 'held' to 'released'
  // Or check if log exists and is held, then update
  let rewardLog = null;
  if (type === 'provider') {
    rewardLog = await ReferralRewardLog.findOneAndUpdate(
      {
        referral: referral._id,
        rewardType: 'providermilestone',
        'details.milestoneBookingsCount': milestoneCount,
        status: 'held'
      },
      { $set: { status: 'released', amount: finalReward } },
      { session, new: true }
    );
    if (!rewardLog) {
      console.log(`[ReferralReward] Held reward log for milestone ${milestoneCount} not found or already released.`);
      return;
    }
  } else {
    // For customer referrals
    rewardLog = new ReferralRewardLog({
      referral: referral._id,
      rewardType: 'customerreferral',
      recipient: referrer._id,
      recipientModel: referrer.role === 'provider' ? 'Provider' : 'User',
      recipientType: referrer.role === 'provider' ? 'provider' : 'customer',
      amount: finalReward,
      details: {
        bookingId: booking?._id
      },
      status: 'released'
    });
    await rewardLog.save({ session });
  }

  // Update referrer wallet balance
  if (!referrer.wallet) {
    referrer.wallet = { availableBalance: 0, totalRefunded: 0, walletTransactions: [], lastUpdated: new Date() };
  }
  
  const originalBalance = referrer.wallet.availableBalance || 0;
  referrer.wallet.availableBalance = parseFloat((originalBalance + finalReward).toFixed(2));

  const reasonText = type === 'customer'
    ? `Referral Reward: Friend booking completed (${booking?.bookingId || booking?._id})`
    : `Provider referral milestone reward`;

  referrer.wallet.walletTransactions.push({
    type: 'credit',
    amount: finalReward,
    reason: reasonText,
    status: 'success',
    booking: booking?._id,
    createdAt: new Date()
  });
  referrer.wallet.lastUpdated = new Date();
  
  // Save referrer using the session
  if (referrer.save) {
    await referrer.save({ session });
  } else {
    const RefModel = referrer.role === 'provider' ? mongoose.model('Provider') : mongoose.model('User');
    await RefModel.updateOne(
      { _id: referrer._id },
      { 
        $set: { wallet: referrer.wallet } 
      },
      { session }
    );
  }

  // Create Ledger Transaction
  const transaction = new Transaction({
    booking: booking?._id,
    bookingId: booking?.bookingId || booking?._id?.toString(),
    user: referrer._id,
    [referrer.role === 'provider' ? 'provider' : 'customer']: referrer._id,
    [referrer.role === 'provider' ? 'providerId' : 'customerId']: referrer._id.toString(),
    amount: finalReward,
    paymentStatus: 'completed',
    paymentMethod: 'wallet',
    type: 'referralreward', // Normalized (no underscore)
    description: reasonText,
    balanceBefore: originalBalance,
    balanceAfter: referrer.wallet.availableBalance
  });
  await transaction.save({ session });

  return transaction;
};

/**
 * 11. applyProviderReferralBenefit()
 * Applies commission discount and priority onboarding parameters to referred providers.
 */
const applyProviderReferralBenefit = async (provider, settings) => {
  provider.referralBenefit = {
    commissionDiscountPercent: settings.providerCommissionDiscountPercent ?? settings.commissionPercentage ?? 10,
    validTill: new Date(Date.now() + (settings.expiryDays || 30) * 24 * 60 * 60 * 1000),
    bookingsLimit: settings.providerCommissionDiscountLimitBookings || 5,
    bookingsCount: 0,
    maxMonetaryBenefit: settings.providerCommissionDiscountMaxBenefit || 1000,
    currentMonetaryBenefit: 0
  };
  provider.onboardingPriorityExpiresAt = new Date(Date.now() + (settings.expiryDays || 30) * 24 * 60 * 60 * 1000);
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

/**
 * 13. getReferralCommissionDiscount()
 * Pure read-only helper checking if referralBenefit is valid and within limits.
 */
const getReferralCommissionDiscount = (providerDoc, rule, baseForCommission) => {
  if (!providerDoc || !providerDoc.referralBenefit) return rule ? rule.value : 0;
  const benefit = providerDoc.referralBenefit;
  if (!benefit.validTill || new Date(benefit.validTill) < new Date()) return rule ? rule.value : 0;

  // Check booking limit
  if (benefit.bookingsLimit && benefit.bookingsCount >= benefit.bookingsLimit) return rule ? rule.value : 0;

  // Check monetary benefit cap
  if (benefit.maxMonetaryBenefit && benefit.currentMonetaryBenefit >= benefit.maxMonetaryBenefit) return rule ? rule.value : 0;

  const ruleValue = rule ? rule.value : 0;
  const discountPercent = benefit.commissionDiscountPercent || 0;
  if (discountPercent <= 0) return ruleValue;

  const normalCommission = parseFloat(((baseForCommission * ruleValue) / 100).toFixed(2));
  const proposedRate = Math.max(0, ruleValue - discountPercent);
  const proposedCommission = parseFloat(((baseForCommission * proposedRate) / 100).toFixed(2));
  const savedAmount = parseFloat((normalCommission - proposedCommission).toFixed(2));

  const remainingCap = Math.max(0, (benefit.maxMonetaryBenefit || 1000) - (benefit.currentMonetaryBenefit || 0));
  if (savedAmount > remainingCap) {
    const adjustedCommission = Math.max(0, normalCommission - remainingCap);
    const adjustedRate = baseForCommission > 0 ? parseFloat(((adjustedCommission * 100) / baseForCommission).toFixed(4)) : 0;
    return adjustedRate;
  }

  return proposedRate;
};

/**
 * 14. incrementReferralBenefitUsage()
 * Performs atomic conditional update on Booking to guarantee exact idempotency.
 */
const incrementReferralBenefitUsage = async (bookingId, session) => {
  if (!bookingId) return;
  const Booking = mongoose.model('Booking');
  const Provider = mongoose.model('Provider');

  // Atomically update Booking referralBenefitCounted from false/undefined to true
  const bookingDoc = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      referralDiscountApplied: true,
      referralBenefitCounted: { $ne: true }
    },
    { $set: { referralBenefitCounted: true } },
    { session, new: true }
  );

  if (!bookingDoc || !bookingDoc.provider) {
    return;
  }

  const provider = await Provider.findById(bookingDoc.provider).session(session);
  if (!provider || !provider.referralBenefit) return;

  const benefit = provider.referralBenefit;
  if (!benefit.validTill || new Date(benefit.validTill) < new Date()) return;
  if (benefit.bookingsLimit && benefit.bookingsCount >= benefit.bookingsLimit) return;
  if (benefit.maxMonetaryBenefit && benefit.currentMonetaryBenefit >= benefit.maxMonetaryBenefit) return;

  // Fetch standard rule
  const CommissionRule = mongoose.model('CommissionRule');
  const firstService = bookingDoc.services && bookingDoc.services[0];
  const serviceId = firstService ? firstService.service : null;
  const originalRule = await CommissionRule.getCommissionForProvider(provider._id, bookingDoc.zoneId, 'standard', serviceId);
  if (!originalRule) return;

  const baseForCommission = Math.max(0, (bookingDoc.subtotal || 0) - (bookingDoc.totalDiscount || 0));
  const normalCommission = parseFloat(((baseForCommission * originalRule.value) / 100).toFixed(2));
  const actualCommission = bookingDoc.commissionAmount || 0;
  const savedAmount = Math.max(0, parseFloat((normalCommission - actualCommission).toFixed(2)));

  if (savedAmount > 0 || benefit.commissionDiscountPercent > 0) {
    const updatedBookingsCount = (benefit.bookingsCount || 0) + 1;
    const updatedMonetaryBenefit = parseFloat(((benefit.currentMonetaryBenefit || 0) + savedAmount).toFixed(2));

    await Provider.updateOne(
      { _id: provider._id },
      {
        $set: {
          'referralBenefit.bookingsCount': updatedBookingsCount,
          'referralBenefit.currentMonetaryBenefit': updatedMonetaryBenefit,
          ...( (updatedBookingsCount >= benefit.bookingsLimit || updatedMonetaryBenefit >= benefit.maxMonetaryBenefit) ? { 'referralBenefit.validTill': new Date() } : {} )
        }
      },
      { session }
    );
    console.log(`[ReferralBenefit] Atomically incremented usage for provider ${provider._id} in session: Bookings: ${updatedBookingsCount}, Benefit: ₹${updatedMonetaryBenefit}`);
  }
};

/**
 * 15. isBookingSettled()
 * Checks if a referred provider's booking is fully settled financially.
 */
const isBookingSettled = async (bookingId, providerId, session) => {
  const Booking = mongoose.model('Booking');
  const ProviderEarning = mongoose.model('ProviderEarning');

  const booking = await Booking.findById(bookingId).session(session).lean();
  if (!booking) return false;

  // Must be completed
  if (booking.status !== 'completed') return false;

  // Payment status must be paid or settled
  if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'settled') return false;

  // No dispute active
  if (booking.disputeRaised || ['pending', 'underreview'].includes(booking.disputeStatus)) return false;

  // No refund approved/processed
  if (booking.adminRefundDecision === 'approved' || ['refundpending', 'refundapproved', 'refunded'].includes(booking.paymentStatus)) return false;

  // ProviderEarning check
  const earning = await ProviderEarning.findOne({ booking: bookingId, provider: providerId }).session(session).lean();
  if (!earning) return false;

  // Earning must be available or paid
  if (earning.status !== 'available' && earning.status !== 'paid') return false;

  return true;
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
  checkQualifiedReferralLimit,
  getReferralCommissionDiscount,
  incrementReferralBenefitUsage,
  isBookingSettled
};
