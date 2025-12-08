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

  grossAmount: {
    type: Number,
    required: true,
    min: 0
  },
  commissionRate: {
    type: Number,
    required: true,
    default: 0
  },
  commissionAmount: {
    type: Number,
    required: true,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentRecord: {
    type: Schema.Types.ObjectId,
    ref: 'PaymentRecord'
  },

  // Only completed booking earnings should be visible
  isVisibleToProvider: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Indexes for fast queries
providerEarningSchema.index({ provider: 1, booking: 1 }, { unique: true });
providerEarningSchema.index({ isVisibleToProvider: 1 });

/**
 * Static method to create earning only when booking is completed
 */
providerEarningSchema.statics.createFromBooking = async function (bookingDoc) {
  if (!bookingDoc || bookingDoc.status !== 'completed') {
    throw new Error('Earnings can only be created for completed bookings.');
  }

  return this.create({
    provider: bookingDoc.provider,
    booking: bookingDoc._id,
    grossAmount: bookingDoc.totalAmount,
    commissionRate: bookingDoc.commissionRule ? bookingDoc.commissionRule.rate : 0,
    commissionAmount: bookingDoc.commissionAmount,
    netAmount: bookingDoc.providerEarnings,
    isVisibleToProvider: true
  });
};

/**
 * Static method to get earnings summary for a provider
 */
providerEarningSchema.statics.getEarningsSummary = async function (providerId) {
  return this.aggregate([
    {
      $match: {
        provider: new mongoose.Types.ObjectId(providerId),
        isVisibleToProvider: true,
      },
    },
    {
      $lookup: {
        from: 'paymentrecords',
        localField: 'paymentRecord',
        foreignField: '_id',
        as: 'paymentInfo',
      },
    },
    {
      $unwind: {
        path: '$paymentInfo',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingInfo',
      },
    },
    {
      $unwind: '$bookingInfo',
    },
    {
      $project: {
        grossAmount: 1,
        commissionAmount: 1,
        netAmount: 1,
        paymentInfo: 1,
        bookingInfo: 1,
        status: {
          $cond: [
            { $eq: ['$bookingInfo.paymentMethod', 'cash'] },
            'paid by cash',
            {
              $cond: [
                { $eq: ['$bookingInfo.paymentMethod', 'online'] },
                {
                  $cond: [
                    { $ifNull: ['$paymentInfo', false] },
                    {
                      $switch: {
                        branches: [
                          { case: { $eq: ['$paymentInfo.status', 'completed'] }, then: 'paid by online' },
                          { case: { $in: ['$paymentInfo.status', ['pending', 'processing']] }, then: 'processing' },
                          { case: { $in: ['$paymentInfo.status', ['failed', 'rejected']] }, then: 'failed' },
                        ],
                        default: 'unknown',
                      },
                    },
                    // No paymentInfo exists: check if more than 7 days passed since booking updatedAt
                    'paid by online', 
                  ],
                },
                'unknown',
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$status',
        totalGross: { $sum: '$grossAmount' },
        totalCommission: { $sum: '$commissionAmount' },
        totalNet: { $sum: '$netAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

/**
 * Static method to get available balance for a provider
 */
providerEarningSchema.statics.getAvailableBalance = async function (providerId) {
  const result = await this.aggregate([
    {
      $match: {
        provider: new mongoose.Types.ObjectId(providerId),
        isVisibleToProvider: true,
        paymentRecord: { $exists: false }
      }
    },
    {
      $group: {
        _id: null,
        balance: { $sum: '$netAmount' }
      }
    }
  ]);

  return result.length > 0 ? result[0].balance : 0;
};

module.exports = mongoose.model('ProviderEarning', providerEarningSchema);
