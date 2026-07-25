require('dotenv').config();
const mongoose = require('mongoose');

const statusMigrationMap = {
  'pending': 'pending',
  'searchingprovider': 'searchingprovider',
  'reassigned': 'searchingprovider',
  'waiting admin assignment': 'searchingprovider',
  'waitingadminassignment': 'searchingprovider',
  'offered': 'offered',
  'assigned': 'accepted',
  'accepted': 'accepted',
  'confirmed': 'accepted',
  'scheduled': 'accepted',
  'ontheway': 'ontheway',
  'arriving': 'ontheway',
  'arrived': 'arrived',
  'started': 'workstarted',
  'workstarted': 'workstarted',
  'inprogress': 'workstarted',
  'in-progress': 'workstarted',
  'in_progress': 'workstarted',
  'processing': 'workstarted',
  'completed': 'completed',
  'cancelled': 'cancelled',
  'refunded': 'cancelled',
  'expired': 'cancelled',
  'rejected': 'rejected',
  'no-show': 'noshow',
  'no_show': 'noshow',
  'noshow': 'noshow'
};

const normalizeStatus = (rawStatus) => {
  if (!rawStatus) return 'pending';
  const cleanKey = String(rawStatus).toLowerCase().trim();
  const sanitizedKey = cleanKey.replace(/[^a-z0-9\s]/g, '');
  return statusMigrationMap[cleanKey] || statusMigrationMap[sanitizedKey] || cleanKey;
};

const runMigration = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/service-marketplace';
  console.log(`[Migration] Connecting to MongoDB: ${mongoUri}`);

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const bookingsCollection = db.collection('bookings');

  const bookings = await bookingsCollection.find({}).toArray();
  console.log(`[Migration] Found ${bookings.length} booking records to analyze/migrate.`);

  let updatedCount = 0;

  for (const booking of bookings) {
    let modified = false;
    const oldStatus = booking.status;
    const newStatus = normalizeStatus(oldStatus);

    if (oldStatus !== newStatus) {
      modified = true;
    }

    let updatedHistory = booking.statusHistory;
    if (Array.isArray(booking.statusHistory) && booking.statusHistory.length > 0) {
      updatedHistory = booking.statusHistory.map(item => {
        if (item && item.status) {
          const normHistStatus = normalizeStatus(item.status);
          if (normHistStatus !== item.status) {
            modified = true;
            return { ...item, status: normHistStatus };
          }
        }
        return item;
      });
    }

    if (modified) {
      await bookingsCollection.updateOne(
        { _id: booking._id },
        { $set: { status: newStatus, statusHistory: updatedHistory } }
      );
      updatedCount++;
    }
  }

  console.log(`[Migration] Successfully updated ${updatedCount} booking document(s) to canonical status convention.`);
  await mongoose.disconnect();
  process.exit(0);
};

runMigration().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
