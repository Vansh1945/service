const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  // Common fields
  type: {
    type: String,
    required: true,
    enum: ['user-payment', 'provider-withdrawal', 'admin-commission', 'admin-payout'],
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    set: v => parseFloat(v.toFixed(2)) // Ensure 2 decimal places
  },
  status: {
    type: String,
    required: true,
    enum: ['success', 'pending', 'failed', 'processing'],
    default: 'pending'
  },
  date: {
    type: Date,
    default: Date.now
  },
  description: String,
  transactionId: {
    type: String,
    unique: true,
    required: true
  },

  // User payment fields
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function() { 
      return this.type === 'user-payment'; 
    }
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: function() {
      return this.type === 'user-payment' || this.type === 'admin-commission';
    }
  },
  paymentMethod: {
    type: String,
    enum: ['credit-card', 'debit-card', 'upi', 'netbanking', 'wallet'],
    required: function() {
      return this.type === 'user-payment';
    }
  },

  // Provider fields
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: function() { 
      return this.type === 'admin-commission' || this.type === 'provider-withdrawal'; 
    }
  },
  providerBankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },

  // Admin fields
  admin: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  adminBankDetails: {
    accountNumber: String,
    ifscCode: String
  },

  // Commission details (added for integration with CommissionRule)
  commissionDetails: {
    ruleApplied: {
      type: Schema.Types.ObjectId,
      ref: 'CommissionRule'
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    commissionValue: {
      type: Number,
      min: 0
    },
    calculatedAmount: {
      type: Number,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
transactionSchema.index({ user: 1 });
transactionSchema.index({ provider: 1 });
transactionSchema.index({ booking: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'commissionDetails.ruleApplied': 1 });

// Pre-save hooks
transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = generateTransactionId(this.type);
  }
  next();
});

// Virtuals
transactionSchema.virtual('formattedAmount').get(function() {
  return `₹${this.amount.toFixed(2)}`;
});

transactionSchema.virtual('isWithdrawal').get(function() {
  return this.type === 'provider-withdrawal';
});

// Static Methods
transactionSchema.statics.recordUserPayment = async function(userId, bookingId, amount, paymentMethod) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const booking = await mongoose.model('Booking').findById(bookingId).session(session);
    const provider = await mongoose.model('Provider').findById(booking.provider).session(session);
    
    // Get applicable commission rule
    const commissionRule = await mongoose.model('CommissionRule').getCommissionForBooking({
      providerId: booking.provider,
      serviceCategory: booking.serviceCategory,
      bookingAmount: amount,
      providerLocation: provider.location,
      providerPerformanceTier: provider.performanceTier
    });

    // Calculate commission
    let commissionAmount;
    if (commissionRule.type === 'percentage') {
      commissionAmount = amount * (commissionRule.value / 100);
    } else {
      commissionAmount = commissionRule.value;
    }
    commissionAmount = parseFloat(commissionAmount.toFixed(2));
    
    const providerAmount = amount - commissionAmount;
    
    // 1. Record user payment to admin
    const userPayment = new this({
      type: 'user-payment',
      amount,
      status: 'success',
      user: userId,
      booking: bookingId,
      paymentMethod,
      description: `Payment for booking ${bookingId}`
    });

    // 2. Record admin commission with rule details
    const adminCommission = new this({
      type: 'admin-commission',
      amount: commissionAmount,
      status: 'success',
      provider: booking.provider,
      booking: bookingId,
      description: `Commission from booking ${bookingId}`,
      commissionDetails: {
        ruleApplied: commissionRule._id || null,
        commissionType: commissionRule.type,
        commissionValue: commissionRule.value,
        calculatedAmount: commissionAmount
      }
    });

    // 3. Record provider earnings (not immediately withdrawable)
    await mongoose.model('ProviderEarning').create({
      provider: booking.provider,
      booking: bookingId,
      amount: providerAmount,
      status: 'pending',
      availableAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days hold
      commissionDetails: {
        ruleApplied: commissionRule._id || null,
        commissionType: commissionRule.type,
        commissionValue: commissionRule.value,
        calculatedAmount: commissionAmount
      }
    });

    await userPayment.save({ session });
    await adminCommission.save({ session });
    await session.commitTransaction();
    
    return userPayment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

transactionSchema.statics.processProviderWithdrawal = async function(providerId, amount, bankDetails) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Check available balance
    const availableBalance = await mongoose.model('ProviderEarning').getAvailableBalance(providerId);
    if (availableBalance < amount) {
      throw new Error('Insufficient available balance');
    }

    // 2. Create withdrawal request
    const withdrawal = new this({
      type: 'provider-withdrawal',
      amount,
      status: 'processing',
      provider: providerId,
      providerBankDetails: bankDetails,
      description: `Withdrawal request of ₹${amount.toFixed(2)}`
    });

    // 3. Mark earnings as processing
    await mongoose.model('ProviderEarning').markAsProcessing(providerId, amount, session);

    await withdrawal.save({ session });
    await session.commitTransaction();
    
    return withdrawal;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Helper function
function generateTransactionId(type) {
  const prefix = {
    'user-payment': 'UP',
    'provider-withdrawal': 'PW',
    'admin-commission': 'AC',
    'admin-payout': 'AP'
  }[type] || 'TX';
  
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;