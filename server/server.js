const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

const adminRoutes = require("./routes/Admin-Routes");
const providerRoutes = require("./routes/Provider-Routes");
const customerRoutes = require("./routes/User-Routes");
const authRoutes = require("./routes/Auth-routes");
const questionRoutes = require("./routes/Question-route");

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS' ,'PATCH'], // Explicitly allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Explicitly allowed headers
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use("/uploads", express.static("uploads"));


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/question", questionRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message, err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Connect to MongoDB
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));