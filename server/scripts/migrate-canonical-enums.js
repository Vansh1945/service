require('dotenv').config();
const mongoose = require('mongoose');

const cleanEnum = (val) => {
  if (!val) return val;
  return String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
};

const runCanonicalEnumMigration = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/service-marketplace';
  console.log(`[Canonical Enum Migration] Connecting to MongoDB: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    // 1. Migrate Bookings Collection
    const bookingsCollection = db.collection('bookings');
    const bookings = await bookingsCollection.find({}).toArray();
    let updatedBookings = 0;

    for (const b of bookings) {
      const updates = {};
      if (b.cancellationProgress && b.cancellationProgress.status) {
        const cleanCP = cleanEnum(b.cancellationProgress.status);
        if (cleanCP !== b.cancellationProgress.status) {
          updates['cancellationProgress.status'] = cleanCP;
        }
      }
      if (b.paymentStatus) {
        const pMap = {
          'escrow_hold': 'escrowhold',
          'settlement_pending': 'settlementpending',
          'refund_pending': 'refundpending',
          'refund_approved': 'refundapproved'
        };
        const targetPS = pMap[b.paymentStatus.toLowerCase()] || cleanEnum(b.paymentStatus);
        if (targetPS !== b.paymentStatus) {
          updates['paymentStatus'] = targetPS;
        }
      }
      if (b.paymentMethod && b.paymentMethod.includes('_')) {
        updates['paymentMethod'] = cleanEnum(b.paymentMethod);
      }

      if (Object.keys(updates).length > 0) {
        await bookingsCollection.updateOne({ _id: b._id }, { $set: updates });
        updatedBookings++;
      }
    }
    console.log(`[Canonical Enum Migration] Updated ${updatedBookings} Bookings records.`);

    // 2. Migrate Payment Records Collection
    const paymentRecordsCol = db.collection('paymentrecords');
    const pRecords = await paymentRecordsCol.find({ paymentMethod: 'bank_transfer' }).toArray();
    if (pRecords.length > 0) {
      await paymentRecordsCol.updateMany(
        { paymentMethod: 'bank_transfer' },
        { $set: { paymentMethod: 'banktransfer' } }
      );
      console.log(`[Canonical Enum Migration] Updated ${pRecords.length} PaymentRecords (bank_transfer -> banktransfer).`);
    }

    // 3. Migrate Referral Reward Logs Collection
    const rewardLogsCol = db.collection('referralrewardlogs');
    const rewardLogs = await rewardLogsCol.find({}).toArray();
    let updatedRewardLogs = 0;
    for (const log of rewardLogs) {
      if (log.rewardType && log.rewardType.includes('_')) {
        await rewardLogsCol.updateOne(
          { _id: log._id },
          { $set: { rewardType: cleanEnum(log.rewardType) } }
        );
        updatedRewardLogs++;
      }
    }
    console.log(`[Canonical Enum Migration] Updated ${updatedRewardLogs} ReferralRewardLogs records.`);

    // 4. Migrate Providers Collection Badges
    const providersCol = db.collection('providers');
    const providers = await providersCol.find({}).toArray();
    let updatedProviders = 0;
    for (const p of providers) {
      if (p.performanceScore && p.performanceScore.badge && /[A-Z]/.test(p.performanceScore.badge)) {
        await providersCol.updateOne(
          { _id: p._id },
          { $set: { 'performanceScore.badge': p.performanceScore.badge.toLowerCase() } }
        );
        updatedProviders++;
      }
    }
    console.log(`[Canonical Enum Migration] Updated ${updatedProviders} Providers badges to lowercase.`);

    // 5. Migrate Notifications Collection Types
    const notificationsCol = db.collection('notifications');
    const oldNotifs = await notificationsCol.find({ type: { $in: ['payout_hold', 'earning_released'] } }).toArray();
    if (oldNotifs.length > 0) {
      await notificationsCol.updateMany({ type: 'payout_hold' }, { $set: { type: 'payouthold' } });
      await notificationsCol.updateMany({ type: 'earning_released' }, { $set: { type: 'earningreleased' } });
      console.log(`[Canonical Enum Migration] Updated ${oldNotifs.length} Notifications types.`);
    }

    // 6. Migrate Complaints Collection Categories
    const complaintsCol = db.collection('complaints');
    const complaints = await complaintsCol.find({}).toArray();
    let updatedComplaints = 0;
    for (const c of complaints) {
      if (c.category) {
        const cleanCat = cleanEnum(c.category);
        if (cleanCat !== c.category) {
          await complaintsCol.updateOne({ _id: c._id }, { $set: { category: cleanCat } });
          updatedComplaints++;
        }
      }
    }
    console.log(`[Canonical Enum Migration] Updated ${updatedComplaints} Complaints categories.`);

    // 7. Migrate Commission Rules Collection Performance Scores
    const commRulesCol = db.collection('commissionrules');
    const commRules = await commRulesCol.find({}).toArray();
    let updatedRules = 0;
    for (const r of commRules) {
      if (r.performanceScore && /[A-Z]/.test(r.performanceScore)) {
        await commRulesCol.updateOne(
          { _id: r._id },
          { $set: { performanceScore: r.performanceScore.toLowerCase() } }
        );
        updatedRules++;
      }
    }
    console.log(`[Canonical Enum Migration] Updated ${updatedRules} CommissionRules performance scores.`);

    console.log('[Canonical Enum Migration] Database migration complete!');
  } catch (err) {
    console.error('[Canonical Enum Migration] Error during migration:', err);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  runCanonicalEnumMigration();
}

module.exports = runCanonicalEnumMigration;
