const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

const adminRoutes = require("./routes/Admin-Routes");
const providerRoutes = require("./routes/Provider-Routes");
const customerRoutes = require("./routes/User-Routes");
const authRoutes = require("./routes/Auth-routes");
const questionRoutes = require("./routes/Question-route");
const testRoutes = require("./routes/Test-route");
const serviceRoutes = require("./routes/Service-route");
const couponRoutes = require("./routes/Coupon-route");
const bookingRoutes = require("./routes/Booking-route");
const invoiceRoutes = require("./routes/Invoice-route");
const transactionRoutes = require("./routes/Transaction-route");



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
app.use("/api/test", testRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/transaction", transactionRoutes);





// Add this route before other routes
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const crypto = require('crypto');
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body.toString();
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature === expectedSignature) {
    const event = JSON.parse(body).event;
    if (event === 'payment.captured') {
      const payload = JSON.parse(body).payload.payment.entity;
      require('./models/Transaction-model ')
        .verifyPayment(payload.order_id, payload.id, signature)
        .catch(console.error);
    }
    res.status(200).send('OK');
  } else {
    res.status(400).send('Invalid signature');
  }
});

// Schedule weekly auto-withdrawals (every Monday at 9 AM)
cron.schedule('0 9 * * 1', () => {
  console.log('Running weekly auto-withdrawals...');
  Transaction.processAutoWithdrawals().catch(console.error);
});


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