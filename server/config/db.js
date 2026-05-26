const mongoose = require('mongoose');
require('dotenv').config();

// Bind connection event listeners to track DB state transitions (Issue #20)
mongoose.connection.on('disconnected', () => {
  console.error('[MongoDB] Warning: Connection disconnected!');
});
mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err.message);
});
mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Connection successfully re-established.');
});

// Robust database connection with exponential backoff retries (Issue #11)
const connectDB = async () => {
  const maxRetries = 5;
  let attempt = 1;
  
  while (attempt <= maxRetries) {
    try {
      console.log(`[MongoDB] Connection attempt ${attempt}/${maxRetries} starting...`);
      const connect = await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 500,
        minPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      });
      console.log("MongoDB Connected Successfully");
      return connect;
    } catch (error) {
      console.error(`[MongoDB] Connection attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        console.error("[MongoDB] All connection retries failed. Exiting process.");
        process.exit(1);
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff capped at 10 seconds
      console.log(`[MongoDB] Waiting ${delay / 1000}s before retrying...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
};

module.exports = connectDB;
