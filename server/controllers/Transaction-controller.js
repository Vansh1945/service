const Transaction = require('../models/Transaction-model ');
const Invoice = require('../models/Invoice-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const CommissionRule = require('../models/CommissionRule-model');
const paymentService = require('../services/payment-service');
const razorpayService = require('../services/razorpay-service');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// =============================================
// CUSTOMER PAYMENT METHODS
// =============================================

/**
 * @desc    Customer pays for a booking
 * @access  Private/User
 */
const payForBooking = asyncHandler(async (req, res) => {
  const { bookingId, amount, paymentMethod } = req.body;
  const userId = req.user._id;

  // Validate payment method
  if (!['online', 'wallet', 'cash'].includes(paymentMethod)) {
    res.status(400);
    throw new Error('Invalid payment method');
  }

  // Validate booking exists and belongs to user
  const booking = await Booking.findOne({ _id: bookingId, customer: userId });
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  // Validate amount
  const expectedAmount = booking.servicePrice - (booking.discountAmount || 0);
  if (amount !== expectedAmount) {
    res.status(400);
    throw new Error('Invalid payment amount');
  }

  let result;
  if (paymentMethod === 'wallet') {
    // Pay from wallet
    result = await paymentService.payFromWallet(userId, bookingId, amount);
  } else {
    // Cash or online payment
    result = await paymentService.createCustomerPayment(
      userId,
      bookingId,
      amount,
      paymentMethod
    );
  }

  res.json({
    success: true,
    transaction: result.transaction,
    razorpayOrder: result.razorpayOrder || null
  });
});

/**
 * @desc    Verify Razorpay payment
 * @access  Private/User
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const transaction = await paymentService.verifyPayment(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  res.json({
    success: true,
    transaction
  });
});

/**
 * @desc    Top up customer wallet
 * @access  Private/User
 */
const topUpWallet = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const userId = req.user._id;

  if (amount <= 0) {
    res.status(400);
    throw new Error('Amount must be positive');
  }

  // Create Razorpay order
  const razorpayOrder = await razorpayService.createOrder(
    amount,
    `Wallet topup for user ${userId}`
  );

  // Create wallet topup transaction
  const transaction = new Transaction({
    type: 'wallet-topup',
    amount,
    status: 'pending',
    user: userId,
    customer: userId,
    paymentMethod: 'online',
    razorpayOrderId: razorpayOrder.id,
    description: `Wallet topup of ₹${amount}`,
    netAmount: amount
  });
  await transaction.save();

  res.json({
    success: true,
    razorpayOrder,
    transaction
  });
});

// =============================================
// PROVIDER WITHDRAWAL METHODS
// =============================================

/**
 * @desc    Initiate provider withdrawal
 * @access  Private/Provider
 */
const initiateWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method, details } = req.body;
  const providerId = req.provider._id;

  // Validate minimum ₹500 rule
  if (amount < 500) {
    res.status(400);
    throw new Error('Minimum withdrawal amount is ₹500');
  }

  // Validate withdrawal method
  if (!['upi', 'bank_transfer'].includes(method)) {
    res.status(400);
    throw new Error('Invalid withdrawal method');
  }

  // Validate details based on method
  if (method === 'upi' && !details.upiId) {
    res.status(400);
    throw new Error('UPI ID is required');
  }
  if (
    method === 'bank_transfer' &&
    (!details.accountNumber || !details.ifscCode || !details.accountHolderName)
  ) {
    res.status(400);
    throw new Error('Bank account details are incomplete');
  }

  const transaction = await paymentService.initiateWithdrawal(
    providerId,
    amount,
    method,
    details
  );

  res.json({
    success: true,
    transaction
  });
});

/**
 * @desc    Process weekly auto-withdrawals for providers
 * @access  Private/Admin
 */
const processAutoWithdrawals = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized');
  }

  // Get providers with auto-withdrawal enabled
  const providers = await Provider.find({
    'settings.autoWithdrawal': true,
    paymentDetails: { $exists: true, $ne: null }
  });

  const results = [];

  for (const provider of providers) {
    try {
      // Get available balance
      const completedTxns = await Transaction.find({
        provider: provider._id,
        status: 'completed',
        paymentMethod: { $ne: 'withdrawal' }
      });

      const withdrawnAmount = await Transaction.aggregate([
        {
          $match: {
            provider: new mongoose.Types.ObjectId(provider._id),
            paymentMethod: 'withdrawal',
            status: 'completed'
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalEarnings = completedTxns.reduce((sum, txn) => sum + (txn.providerAmount || 0), 0);
      const totalWithdrawn = withdrawnAmount.length > 0 ? withdrawnAmount[0].total : 0;
      const availableBalance = totalEarnings - totalWithdrawn;

      // Check minimum ₹500 rule
      if (availableBalance >= 500) {
        const method = provider.settings.withdrawalMethod || 'bank_transfer';
        const details = provider.paymentDetails;

        const transaction = await paymentService.initiateWithdrawal(
          provider._id,
          availableBalance,
          method,
          details
        );

        results.push({
          provider: provider._id,
          amount: availableBalance,
          status: 'success',
          transactionId: transaction._id
        });
      } else {
        results.push({
          provider: provider._id,
          amount: availableBalance,
          status: 'skipped',
          reason: 'Insufficient balance or below minimum'
        });
      }
    } catch (err) {
      results.push({
        provider: provider._id,
        status: 'failed',
        error: err.message
      });
    }
  }

  res.json({
    success: true,
    results
  });
});

// =============================================
// ADMIN COMMISSION METHODS
// =============================================

/**
 * @desc    Create/update commission rule
 * @access  Private/Admin
 */
const manageCommissionRule = asyncHandler(async (req, res) => {
  const {
    name,
    type,
    value,
    applicableTo,
    providers,
    serviceCategories,
    minBookingAmount,
    isActive
  } = req.body;

  // Validate commission rule
  if (!name || !type || value === undefined) {
    res.status(400);
    throw new Error('Missing required fields');
  }

  if (type === 'percentage' && (value < 0 || value > 100)) {
    res.status(400);
    throw new Error('Percentage must be between 0-100');
  }

  if (type === 'fixed' && value < 0) {
    res.status(400);
    throw new Error('Fixed amount cannot be negative');
  }

  if (applicableTo === 'specific' && (!providers || providers.length === 0)) {
    res.status(400);
    throw new Error('Providers required for specific rules');
  }

  if (minBookingAmount && minBookingAmount < 0) {
    res.status(400);
    throw new Error('Minimum booking amount cannot be negative');
  }

  // Create or update rule
  let rule;
  if (req.params.id) {
    rule = await CommissionRule.findByIdAndUpdate(
      req.params.id,
      {
        name,
        type,
        value,
        applicableTo,
        providers: applicableTo === 'specific' ? providers : [],
        serviceCategories: serviceCategories || [],
        minBookingAmount: minBookingAmount || 0,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: req.user._id
      },
      { new: true }
    );
  } else {
    rule = new CommissionRule({
      name,
      type,
      value,
      applicableTo,
      providers: applicableTo === 'specific' ? providers : [],
      serviceCategories: serviceCategories || [],
      minBookingAmount: minBookingAmount || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });
    await rule.save();
  }

  res.json({
    success: true,
    rule
  });
});

/**
 * @desc    Get applicable commission for a booking
 * @access  Private/Admin
 */
const getApplicableCommission = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId)
    .populate('service')
    .populate('provider');

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const provider = await Provider.findById(booking.provider._id);

  const commissionDetails = await CommissionRule.getCommissionForBooking({
    providerId: booking.provider._id,
    serviceCategory: booking.service.category,
    bookingAmount: booking.servicePrice,
    providerLocation: provider.address?.location,
    providerPerformanceTier: provider.performanceTier
  });

  res.json({
    success: true,
    commission: commissionDetails
  });
});

// =============================================
// TRANSACTION HISTORY METHODS
// =============================================

/**
 * @desc    Get transaction history for user or provider
 * @access  Private/User or Private/Provider
 */
const getTransactionHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role; // 'customer' or 'provider'

  const transactions = await paymentService.getTransactions(userId, userRole);

  res.json({
    success: true,
    transactions
  });
});

/**
 * @desc    Get provider earnings summary
 * @access  Private/Provider
 */
const getProviderEarnings = asyncHandler(async (req, res) => {
  const providerId = req.provider._id;

  // Get all completed transactions (non-withdrawal)
  const completedTxns = await Transaction.find({
    provider: providerId,
    status: 'completed',
    paymentMethod: { $ne: 'withdrawal' }
  });

  // Calculate total earnings
  const totalEarnings = completedTxns.reduce((sum, txn) => sum + (txn.providerAmount || 0), 0);

  // Get withdrawn amount
  const withdrawnResult = await Transaction.aggregate([
    {
      $match: {
        provider: new mongoose.Types.ObjectId(providerId),
        paymentMethod: 'withdrawal',
        status: 'completed'
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const totalWithdrawn = withdrawnResult.length > 0 ? withdrawnResult[0].total : 0;
  const availableBalance = totalEarnings - totalWithdrawn;

  res.json({
    success: true,
    earnings: {
      totalEarnings,
      totalWithdrawn,
      availableBalance,
      canWithdraw: availableBalance >= 500 // Minimum ₹500 rule
    }
  });
});

module.exports = {
  payForBooking,
  verifyPayment,
  topUpWallet,
  initiateWithdrawal,
  processAutoWithdrawals,
  manageCommissionRule,
  getApplicableCommission,
  getTransactionHistory,
  getProviderEarnings
};