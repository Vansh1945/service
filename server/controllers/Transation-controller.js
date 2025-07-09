const Transaction = require('../models/Transaction-model ');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');

// @desc    Create payment order
// @route   POST /api/v1/transactions/payment
// @access  Private/User
const createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId, amount, paymentMethod } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.customer.equals(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { transaction, razorpayOrder } = await Transaction.createCustomerPayment(
      req.user.id,
      bookingId,
      amount,
      paymentMethod
    );

    res.status(201).json({
      success: true,
      data: {
        transaction,
        razorpayOrder
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify payment
// @route   POST /api/v1/transactions/verify
// @access  Private/User
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    
    const transaction = await Transaction.verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Top up wallet
// @route   POST /api/v1/transactions/wallet/topup
// @access  Private/User
const topUpWallet = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    
    const { transaction, razorpayOrder } = await Transaction.topUpWallet(
      req.user.id,
      amount,
      paymentMethod
    );

    res.status(201).json({
      success: true,
      data: {
        transaction,
        razorpayOrder
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Pay from wallet
// @route   POST /api/v1/transactions/wallet/pay
// @access  Private/User
const payFromWallet = async (req, res, next) => {
  try {
    const { bookingId, amount } = req.body;
    
    const transaction = await Transaction.payFromWallet(
      req.user.id,
      bookingId,
      amount
    );

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate withdrawal
// @route   POST /api/v1/transactions/withdraw
// @access  Private/Provider
const initiateWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, details } = req.body;
    
    const transaction = await Transaction.initiateWithdrawal(
      req.user.id,
      amount,
      method,
      details
    );

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user transactions
// @route   GET /api/v1/transactions/user
// @access  Private/User
const getUserTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get provider transactions
// @route   GET /api/v1/transactions/provider
// @access  Private/Provider
const getProviderTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ provider: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Process auto withdrawals (Admin)
// @route   POST /api/v1/transactions/process-withdrawals
// @access  Private/Admin
const processAutoWithdrawals = async (req, res, next) => {
  try {
    await Transaction.processAutoWithdrawals();
    
    res.status(200).json({
      success: true,
      message: 'Auto withdrawals processed successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  topUpWallet,
  payFromWallet,
  initiateWithdrawal,
  getUserTransactions,
  getProviderTransactions,
  processAutoWithdrawals
};