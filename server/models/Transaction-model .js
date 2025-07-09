const mongoose = require('mongoose');
const { Schema } = mongoose;
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const transactionSchema = new Schema({
  // Core transaction details
  type: {
    type: String,
    required: true,
    enum: [
      'user-payment',        // Customer pays for booking
      'advance-payment',     // Customer pays advance
      'provider-withdrawal', // Provider withdraws earnings
      'admin-commission',    // Admin's commission from booking
      'wallet-topup',        // Customer adds money to wallet
      'refund'               // Refund to customer
    ]
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'success', 'failed', 'processing'],
    default: 'pending'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  
  // User-related transactions
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking'
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'debit_card', 'credit_card', 'netbanking', 'wallet', 'qr_scan']
  },
  
  // Provider-related transactions
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider'
  },
  withdrawalMethod: {
    type: String,
    enum: ['upi', 'bank_transfer']
  },
  withdrawalDetails: {
    upiId: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  
  // Admin commission details
  commissionRule: {
    type: Schema.Types.ObjectId,
    ref: 'CommissionRule'
  },
  commissionAmount: Number,
  
  // Metadata
  description: String,
  fees: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  isAutoWithdrawal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes
transactionSchema.index({ user: 1, status: 1 });
transactionSchema.index({ provider: 1, status: 1 });
transactionSchema.index({ razorpayOrderId: 1 });
transactionSchema.index({ createdAt: 1 });

// ========================
// CUSTOMER PAYMENT METHODS
// ========================

/**
 * Create a Razorpay order for customer payment
 */
transactionSchema.statics.createCustomerPayment = async function(userId, bookingId, amount, paymentMethod) {
  const options = {
    amount: amount * 100, // Razorpay expects paise
    currency: "INR",
    receipt: `booking_${bookingId}_${Date.now()}`,
    payment_capture: 1,
    notes: {
      userId: userId.toString(),
      bookingId: bookingId.toString(),
      paymentMethod
    }
  };

  try {
    const order = await razorpay.orders.create(options);
    
    const transaction = new this({
      type: paymentMethod === 'wallet' ? 'wallet-topup' : 'user-payment',
      amount,
      status: 'pending',
      user: userId,
      booking: bookingId,
      paymentMethod,
      razorpayOrderId: order.id,
      description: `Payment for booking ${bookingId}`,
      netAmount: amount
    });

    await transaction.save();
    return { transaction, razorpayOrder: order };
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    throw new Error('Payment processing failed');
  }
};

/**
 * Verify Razorpay payment and complete transaction
 */
transactionSchema.statics.verifyPayment = async function(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature !== razorpaySignature) {
    throw new Error('Invalid payment signature');
  }

  const transaction = await this.findOne({ razorpayOrderId });
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Update transaction status
  transaction.status = 'success';
  transaction.razorpayPaymentId = razorpayPaymentId;
  transaction.razorpaySignature = razorpaySignature;
  await transaction.save();

  // Handle different transaction types
  if (transaction.type === 'user-payment') {
    await handleBookingPayment(transaction);
  } else if (transaction.type === 'wallet-topup') {
    await handleWalletTopup(transaction);
  }

  return transaction;
};

async function handleBookingPayment(transaction) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await mongoose.model('Booking').findById(transaction.booking).session(session);
    
    // 1. Update booking payment status
    booking.paymentStatus = transaction.amount >= booking.totalAmount ? 'paid' : 'partially_paid';
    booking.paidAmount = (booking.paidAmount || 0) + transaction.amount;
    await booking.save({ session });

    // 2. Create admin commission transaction
    const commissionDetails = await calculateCommission(booking, transaction.amount);
    
    const commissionTx = new this({
      type: 'admin-commission',
      amount: commissionDetails.commissionAmount,
      status: 'success',
      provider: booking.provider,
      booking: booking._id,
      commissionRule: commissionDetails.rule?._id,
      commissionAmount: commissionDetails.commissionAmount,
      description: `Commission from booking ${booking._id}`,
      netAmount: commissionDetails.commissionAmount
    });
    await commissionTx.save({ session });

    // 3. Add to provider's earnings (with 7-day hold)
    await mongoose.model('ProviderEarning').create([{
      provider: booking.provider,
      booking: booking._id,
      amount: transaction.amount - commissionDetails.commissionAmount,
      status: 'pending',
      availableAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day hold
      commissionDetails: {
        ruleApplied: commissionDetails.rule?._id,
        commissionAmount: commissionDetails.commissionAmount
      }
    }], { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function calculateCommission(booking, amount) {
  const provider = await mongoose.model('Provider').findById(booking.provider);
  const service = await mongoose.model('Service').findById(booking.service);
  
  const rule = await mongoose.model('CommissionRule').findOne({
    isActive: true,
    $or: [
      { applicableTo: 'all' },
      { applicableTo: 'specific', providers: booking.provider }
    ],
    $or: [
      { serviceCategories: [] },
      { serviceCategories: service.category }
    ],
    minBookingAmount: { $lte: amount }
  }).sort({ minBookingAmount: -1 });

  let commissionAmount = 0;
  if (rule) {
    commissionAmount = rule.type === 'percentage' 
      ? amount * (rule.value / 100)
      : rule.value;
  } else {
    // Default 20% commission if no rule found
    commissionAmount = amount * 0.20;
  }

  return {
    rule,
    commissionAmount: Math.round(commissionAmount * 100) / 100
  };
}

// ========================
// PROVIDER WITHDRAWAL METHODS
// ========================

/**
 * Initiate provider withdrawal
 */
transactionSchema.statics.initiateWithdrawal = async function(providerId, amount, method, details) {
  // 1. Check minimum ₹500 balance rule
  if (amount < 500) {
    throw new Error('Minimum withdrawal amount is ₹500');
  }

  // 2. Check available balance
  const availableBalance = await mongoose.model('ProviderEarning').getAvailableBalance(providerId);
  if (availableBalance < amount) {
    throw new Error('Insufficient available balance');
  }

  // 3. Calculate fees (2% for manual withdrawals)
  const fees = method === 'manual' ? amount * 0.02 : 0;
  const netAmount = amount - fees;

  // 4. Create withdrawal transaction
  const withdrawal = new this({
    type: 'provider-withdrawal',
    amount,
    status: 'processing',
    provider: providerId,
    withdrawalMethod: method === 'upi' ? 'upi' : 'bank_transfer',
    withdrawalDetails: details,
    fees,
    netAmount,
    description: `Withdrawal request of ₹${amount}`
  });

  await withdrawal.save();

  // 5. Process via Razorpay Payouts
  try {
    const payout = await razorpay.payouts.create({
      account_number: details.accountNumber || details.upiId,
      fund_account: {
        account_type: method === 'upi' ? 'vpa' : 'bank_account',
        ...(method === 'upi' ? {
          vpa: {
            address: details.upiId
          }
        } : {
          bank_account: {
            name: details.accountHolderName,
            ifsc: details.ifscCode,
            account_number: details.accountNumber
          }
        })
      },
      amount: netAmount * 100,
      currency: 'INR',
      mode: method === 'upi' ? 'UPI' : 'IMPS',
      purpose: 'payout',
      reference_id: withdrawal._id.toString(),
      narration: 'Provider earnings withdrawal'
    });

    withdrawal.razorpayPaymentId = payout.id;
    await withdrawal.save();

    return withdrawal;
  } catch (err) {
    console.error('Razorpay payout failed:', err);
    withdrawal.status = 'failed';
    await withdrawal.save();
    throw new Error('Withdrawal processing failed');
  }
};

/**
 * Weekly auto-withdrawal for providers
 */
transactionSchema.statics.processAutoWithdrawals = async function() {
  const providers = await mongoose.model('Provider').find({
    'settings.autoWithdrawal': true
  });

  for (const provider of providers) {
    const balance = await mongoose.model('ProviderEarning').getAvailableBalance(provider._id);
    
    if (balance >= 500) { // Minimum ₹500 rule
      try {
        await this.initiateWithdrawal(
          provider._id,
          balance,
          provider.settings.withdrawalMethod || 'bank_transfer',
          {
            upiId: provider.paymentDetails.upiId,
            accountNumber: provider.paymentDetails.accountNumber,
            ifscCode: provider.paymentDetails.ifscCode,
            accountHolderName: provider.paymentDetails.accountHolderName,
            bankName: provider.paymentDetails.bankName
          }
        );
      } catch (err) {
        console.error(`Auto-withdrawal failed for provider ${provider._id}:`, err);
      }
    }
  }
};

// ========================
// WALLET METHODS
// ========================

/**
 * Top up customer wallet
 */
transactionSchema.statics.topUpWallet = async function(userId, amount, paymentMethod) {
  const transaction = await this.createCustomerPayment(
    userId,
    null, // No booking ID for wallet topup
    amount,
    paymentMethod
  );

  transaction.type = 'wallet-topup';
  await transaction.save();
  return transaction;
};

async function handleWalletTopup(transaction) {
  await mongoose.model('User').findByIdAndUpdate(transaction.user, {
    $inc: { walletBalance: transaction.amount }
  });
}

/**
 * Pay from wallet
 */
transactionSchema.statics.payFromWallet = async function(userId, bookingId, amount) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check wallet balance
    const user = await mongoose.model('User').findById(userId).session(session);
    if (user.walletBalance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // 2. Create transaction
    const transaction = new this({
      type: 'user-payment',
      amount,
      status: 'success',
      user: userId,
      booking: bookingId,
      paymentMethod: 'wallet',
      description: `Wallet payment for booking ${bookingId}`,
      netAmount: amount
    });
    await transaction.save({ session });

    // 3. Deduct from wallet
    user.walletBalance -= amount;
    await user.save({ session });

    // 4. Process booking payment
    await handleBookingPayment(transaction);

    await session.commitTransaction();
    return transaction;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;