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
  },
  
  status: {
    type: String,
    enum: ['held', 'available', 'paid', 'withdrawn', 'cancelled', 'underreview', 'pendingrelease'],
    default: 'held',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  availableAfter: {
    type: Date,
    default: null
  },
  holdReason: {
    type: String,
    default: null
  },
  isHeldByAdmin: {
    type: Boolean,
    default: false
  },

  // Audit Snapshots for Dynamic Commission & Financial Traceability
  commissionSource: {
    type: String,
    enum: ['rating_rule', 'standard_rule', 'system_default'],
    default: 'standard_rule'
  },
  commissionRuleId: {
    type: Schema.Types.ObjectId,
    ref: 'CommissionRule',
    default: null
  },
  commissionTypeSnapshot: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  commissionValueSnapshot: {
    type: Number,
    default: null
  },
  commissionRateSnapshot: {
    type: Number,
    default: null
  },
  ratingSnapshot: {
    type: Number,
    default: null
  },
  ratingCountSnapshot: {
    type: Number,
    default: null
  },
  ratingEvaluationPeriodDays: {
    type: Number,
    default: null
  }
}, { timestamps: true });

// Indexes for fast queries
providerEarningSchema.index({ provider: 1, booking: 1 }, { unique: true });
providerEarningSchema.index({ provider: 1 });
providerEarningSchema.index({ provider: 1, createdAt: -1 });
providerEarningSchema.index({ status: 1 });
providerEarningSchema.index({ isVisibleToProvider: 1 });

/**
 * Static method to create earning only when booking is completed
 */
providerEarningSchema.statics.createFromBooking = async function (bookingDoc) {
  if (!bookingDoc || bookingDoc.status !== 'completed') {
    throw new Error('Earnings can only be created for completed bookings.');
  }

  // grossAmount = service base / commission base = subtotal - discount
  // NOT booking.totalAmount (which includes all customer-facing surcharges)
  const grossAmount = Math.max(
    0,
    (bookingDoc.subtotal || 0) - (bookingDoc.totalDiscount || 0)
  );

  const commissionRate = bookingDoc.commissionRateSnapshot ?? bookingDoc.commissionValueSnapshot ?? 0;

  return this.create({
    provider: bookingDoc.provider,
    booking: bookingDoc._id,
    grossAmount,
    commissionRate,
    commissionAmount: bookingDoc.commissionAmount,
    netAmount: bookingDoc.providerEarnings,
    commissionSource: bookingDoc.commissionSource || 'standard_rule',
    commissionRuleId: bookingDoc.commissionRuleId || bookingDoc.commissionRule || null,
    commissionTypeSnapshot: bookingDoc.commissionTypeSnapshot || 'percentage',
    commissionValueSnapshot: bookingDoc.commissionValueSnapshot || null,
    commissionRateSnapshot: bookingDoc.commissionRateSnapshot || null,
    ratingSnapshot: bookingDoc.ratingSnapshot || null,
    ratingCountSnapshot: bookingDoc.ratingCountSnapshot || null,
    ratingEvaluationPeriodDays: bookingDoc.ratingEvaluationPeriodDays || null,
    isVisibleToProvider: true,
    status: bookingDoc.paymentMethod === 'cash' ? 'paid' : 'held',
    availableAfter: bookingDoc.payoutHoldUntil
  });
};

/**
 * Safe, idempotent backfill: correct historical ProviderEarning records where
 * grossAmount was stored as booking.totalAmount (customer's full payment) instead of
 * baseForCommission (subtotal - totalDiscount = service base / commission base).
 *
 * This method:
 *  - Joins each ProviderEarning with its Booking to derive the correct grossAmount.
 *  - Only updates records where the stored grossAmount does NOT match the correct value.
 *  - Does NOT touch netAmount, commissionAmount, status, wallet, withdrawals, or any
 *    payment/payout field. It is purely a reporting-data correction.
 *  - Is idempotent: calling it multiple times produces the same result.
 *  - Returns a summary of how many records were inspected and corrected.
 *
 * @param {import('mongoose').ClientSession} [session] - Optional Mongoose session.
 * @returns {Promise<{ inspected: number, corrected: number }>}
 */
providerEarningSchema.statics.backfillGrossAmount = async function (session) {
  const Booking = mongoose.model('Booking');
  const BATCH = 500;
  let skip = 0;
  let inspected = 0;
  let corrected = 0;

  while (true) {
    // Fetch a batch of earnings joined with their booking
    const batch = await this.aggregate([
      { $skip: skip },
      { $limit: BATCH },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'bookingDoc'
        }
      },
      { $unwind: '$bookingDoc' },
      {
        $project: {
          _id: 1,
          grossAmount: 1,
          correctGross: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: ['$bookingDoc.subtotal', 0] },
                  { $ifNull: ['$bookingDoc.totalDiscount', 0] }
                ]
              }
            ]
          }
        }
      },
      // Only keep records where stored value doesn't match correct value
      {
        $match: {
          $expr: { $ne: ['$grossAmount', '$correctGross'] }
        }
      }
    ]);

    if (batch.length === 0 && skip === 0) break; // no mismatched records at all
    if (batch.length === 0) break;                // exhausted all records

    inspected += BATCH;

    if (batch.length > 0) {
      const bulkOps = batch.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { grossAmount: doc.correctGross } }
        }
      }));
      const result = await this.bulkWrite(bulkOps, session ? { session } : {});
      corrected += result.modifiedCount;
    }

    skip += BATCH;
  }

  return { inspected, corrected };
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
        status: { $ne: 'cancelled' }
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
        paymentRecord: { $exists: false },
        status: { $in: ['available', 'held'] }
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

const recoveryLedgerSchema = new Schema({
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
  complaint: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint',
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    required: true,
    enum: ['wallet', 'heldearnings', 'pendingrelease', 'available', 'platformcreditreserve', 'platformabsorbed'],
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  reason: {
    type: String,
    required: true
  }
}, { timestamps: true });

mongoose.model('RecoveryLedger', recoveryLedgerSchema);

module.exports = mongoose.model('ProviderEarning', providerEarningSchema);

