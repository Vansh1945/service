const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    /* BACKUP COMMENT: Original connection was: await mongoose.connect(process.env.MONGO_URI); */
    const connect = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB connection failed");
    process.exit(1); // Crash the app
  }
};

module.exports = connectDB;
