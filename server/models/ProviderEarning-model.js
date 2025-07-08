const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const providerEarningSchema = new Schema({
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'available', 'processing', 'paid'],
    default: 'pending'
  },
  availableAfter: {
    type: Date,
    required: true
  },
  transaction: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
providerEarningSchema.index({ provider: 1 });
providerEarningSchema.index({ status: 1 });
providerEarningSchema.index({ availableAfter: 1 });

// Static Methods
providerEarningSchema.statics.getAvailableBalance = async function(providerId) {
  const result = await this.aggregate([
    { 
      $match: { 
        provider: providerId,
        status: 'available',
        availableAfter: { $lte: new Date() }
      } 
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length ? result[0].total : 0;
};

providerEarningSchema.statics.markAsProcessing = async function(providerId, amount, session) {
  // Find available earnings and mark them as processing
  const earnings = await this.find({
    provider: providerId,
    status: 'available',
    availableAfter: { $lte: new Date() }
  }).sort({ availableAfter: 1 }).session(session);

  let remaining = amount;
  for (const earning of earnings) {
    if (remaining <= 0) break;
    
    const deductAmount = Math.min(earning.amount, remaining);
    earning.amount -= deductAmount;
    remaining -= deductAmount;
    
    if (earning.amount === 0) {
      earning.status = 'processing';
    } else {
      // Split the earning record
      const newEarning = new this({
        provider: providerId,
        booking: earning.booking,
        amount: deductAmount,
        status: 'processing',
        availableAfter: earning.availableAfter
      });
      await newEarning.save({ session });
    }
    
    await earning.save({ session });
  }

  if (remaining > 0) {
    throw new Error('Insufficient available balance');
  }
};

const ProviderEarning = mongoose.model('ProviderEarning', providerEarningSchema);

module.exports = ProviderEarning;