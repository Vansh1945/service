require('dotenv').config();
const express = require("express");
const cors = require("cors");
const winston = require('winston');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const compression = require("compression");
const helmet = require("helmet");
const mongoSanitize = require("./middlewares/mongo-sanitize");

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const { combine, timestamp, printf, errors } = winston.format;
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(winston.format.colorize(), logFormat)
  }));
}

global.logger = logger;

const connectDB = require("./config/db");
const frontend = process.env.FRONTEND_URL;
const PORT = process.env.PORT || 5000;

// Initialize express app
const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(mongoSanitize({ allowDots: true, replaceWith: '_' }));

const { parseFraudHeaders } = require('./middlewares/fraud-middleware');
app.use(parseFraudHeaders);

// Morgan API Request Logging
app.use(morgan((tokens, req, res) => {
  let url = tokens.url(req, res);
  // Redact sensitive query params
  if (url) {
    url = url.replace(/(token|secret|password)=[^&]+/ig, '$1=***');
  }
  return [
    tokens.method(req, res),
    url,
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}, {
  stream: { write: message => logger.info(message.trim()) },
  skip: (req, res) => {
    const url = req.originalUrl || req.url || '';
    return url.includes('/system-logs');
  }
}));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const isDev = process.env.NODE_ENV !== 'production';

    // allow requests with no origin (mobile apps, postman), allowed origins list, or localhost in development mode
    if (!origin || allowedOrigins.includes(origin) || (isDev && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-device-screenresolution',
    'x-device-timezone',
    'x-device-language',
    'x-device-platform',
    'x-device-hardwareconcurrency',
    'x-device-devicememory',
    'x-device-id'
  ]
};

app.use(cors(corsOptions));

// Middleware

// Test Route 
app.get('/api/test-route', (req, res) => {
  res.send('Raj Electrical Service API is running!');
});

app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static("uploads"));
app.use("/assets", express.static("assets"));

const rateLimit = require('express-rate-limit');

// Specific Rate Limiters for Authentication
/* BACKUP COMMENT: Original was commented-out limiters. Enabling production rate limits now. */
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
// });

// const otpLimiter = rateLimit({
//   windowMs: 10 * 60 * 1000, // 10 minutes
//   max: 3,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { success: false, message: 'Too many OTP requests. Try again in 10 minutes.' }
// });

// Apply rate limiters directly to auth endpoints
// app.use("/api/auth/login", loginLimiter);
// app.use("/api/auth/firebase-login", loginLimiter);
// app.use("/api/auth/forgot-password", otpLimiter);
// app.use("/api/auth/resend-otp", otpLimiter);
// app.use("/api/auth/verify-otp", otpLimiter);

// Route imports
const adminRoutes = require("./routes/Admin-Routes");
const providerRoutes = require("./routes/Provider-Routes");
const customerRoutes = require("./routes/User-Routes");
const authRoutes = require("./routes/Auth-routes");
const questionRoutes = require("./routes/Question-route");
const testRoutes = require("./routes/Test-route");
const serviceRoutes = require("./routes/Service-route");
const couponRoutes = require("./routes/Coupon-route");
const bookingRoutes = require("./routes/Booking-route");
const transactionRoutes = require("./routes/Transaction-route");
const complaintRoutes = require("./routes/complaintRoutes");
const feedbackRoutes = require("./routes/feedback-routes");
const commissionRoutes = require('./routes/commissionRoutes');
const paymentRoutes = require('./routes/payment-routes');
const systemSettingRoutes = require('./routes/SystemSetting-routes');
const contactRoutes = require('./routes/Contact-routes');
const notificationRoutes = require('./routes/notification-routes');
const chatRoutes = require('./routes/Chat-route');
const zoneRoutes = require('./routes/Zone-routes');
const surgeRoutes = require('./routes/Surge-routes');

// Maintenance Mode Middleware
app.use(async (req, res, next) => {
  // Always allow health checks, test-routes, static assets, and uploads
  if (
    req.path === '/health' ||
    req.path === '/api/test-route' ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/assets')
  ) {
    return next();
  }

  try {
    const { SystemConfig } = require('./models/SystemSetting');
    const jwt = require('jsonwebtoken');

    const settings = await SystemConfig.findOne();

    if (!settings?.maintenanceMode) {
      return next();
    }

    // Always allow admin routes
    if (
      req.originalUrl.includes('/api/admin') ||
      req.originalUrl.includes('/admin/login') ||
      req.originalUrl.includes('/api/system-setting')
    ) {
      return next();
    }

    let role = null;

    // Extract role from token if exists
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        role = decoded.role;
      } catch (err) { }
    }

    // CUSTOMER MAINTENANCE
    if (
      settings.maintenanceMode.customer?.enabled &&
      role === 'customer'
    ) {
      return res.status(503).json({
        success: false,
        maintenance: true,
        role: 'customer',
        message:
          settings.maintenanceMode.customer.message ||
          settings.maintenanceMode.globalMessage
      });
    }

    // PROVIDER MAINTENANCE
    if (
      settings.maintenanceMode.provider?.enabled &&
      role === 'provider'
    ) {
      return res.status(503).json({
        success: false,
        maintenance: true,
        role: 'provider',
        message:
          settings.maintenanceMode.provider.message ||
          settings.maintenanceMode.globalMessage
      });
    }

    next();
  } catch (err) {
    next();
  }
});

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
app.use('/api/transaction', transactionRoutes);
app.use('/api/complaint', complaintRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/system-setting', systemSettingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/surge', surgeRoutes);

// Health check endpoint


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});


// Catch-all 404 handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    error: "NOT_FOUND"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message, err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});





// Create HTTP server (required for Socket.io)
const http = require('http');
const { initSocket } = require('./socket/socketServer');
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start server after ensuring MongoDB is connected
const startServer = async () => {
  try {
    await connectDB();

    // Auto-migrate branding from Raj Electrical Services to Raj Electrical Service for instant Google SEO!
    try {
      const { SystemConfig } = require('./models/SystemSetting');
      const existingConfig = await SystemConfig.findOne();
      if (existingConfig) {
        let modified = false;
        if (existingConfig.companyName === 'Default Company' || existingConfig.companyName === 'Raj Electrical Services') {
          existingConfig.companyName = 'Raj Electrical Service';
          modified = true;
        }
        if (existingConfig.customerBranding?.appName === 'Raj Electrical Services Customer' || !existingConfig.customerBranding?.appName) {
          existingConfig.customerBranding = {
            appName: 'Raj Electrical Service',
            shortName: 'Raj Service',
            browserTitle: 'Raj Electrical Service | Book Trusted Electricians Near You',
            description: 'Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Fast, reliable, and affordable electrician service at your doorstep.',
            logo: existingConfig.customerBranding?.logo || '',
            icon: existingConfig.customerBranding?.icon || '',
            splashScreen: existingConfig.customerBranding?.splashScreen || ''
          };
          modified = true;
        }
        if (existingConfig.providerBranding?.appName === 'Raj Electrical Services Provider' || !existingConfig.providerBranding?.appName) {
          existingConfig.providerBranding = {
            appName: 'Raj Provider',
            shortName: 'Raj Partner',
            browserTitle: 'Raj Electrical Partner | Earn as a Certified Electrician',
            description: 'Join Raj Electrical Service as a certified partner. Accept electrical repair and installation bookings and grow your earnings.',
            logo: existingConfig.providerBranding?.logo || '',
            icon: existingConfig.providerBranding?.icon || '',
            splashScreen: existingConfig.providerBranding?.splashScreen || ''
          };
          modified = true;
        }
        if (modified) {
          existingConfig.markModified('customerBranding');
          existingConfig.markModified('providerBranding');
          await existingConfig.save();
          console.log('[SEO Migration] Successfully migrated database branding defaults from Raj Electrical Services to Raj Electrical Service!');
        }
      }
    } catch (migError) {
      console.error('[SEO Migration] Failed to auto-migrate database branding:', migError);
    }

    // Initialize background tasks
    const { releaseHeldEarnings } = require('./controllers/paymentController');
    // Run every hour
    setInterval(async () => {
      console.log('Running background task: releaseHeldEarnings');
      await releaseHeldEarnings();
    }, 60 * 60 * 1000);

    // Initial run on startup
    releaseHeldEarnings().catch(err => console.error('Initial releaseHeldEarnings failed:', err));

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

startServer();
