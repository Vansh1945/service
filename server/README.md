# Server - Backend API Documentation

## 🔹 Backend Overview
This is the backend server for the Service Application, providing a robust, scalable, and secure API architecture. It is responsible for handling database interactions, authentication, role-based access control, booking logic, payment processing, notifications, and real-time communication via WebSockets.

## 🔹 Tech Stack
- **Runtime Environment:** Node.js
- **Web Framework:** Express.js
- **Database:** MongoDB & Mongoose
- **Authentication & Security:** JSON Web Tokens (JWT), bcryptjs, cors, express-rate-limit
- **Real-Time Communication:** Socket.io
- **File & Image Uploads:** Cloudinary, Multer
- **Payments:** Razorpay
- **Notifications & Emails:** Firebase Admin (FCM for push notifications), Nodemailer, Resend
- **Utility Libraries:** Moment.js, ExcelJS (exporting data), PDFKit/Puppeteer (generating PDFs), QRCode, otp-generator

## 🔹 Folder Structure
```text
server/
├── assets/                 # Static assets (fonts, default images, etc.)
├── config/                 # Database and service configuration files (e.g., db.js)
├── controllers/            # Business logic for all endpoints
├── middlewares/            # Custom middleware (Auth, error handling, validation)
├── models/                 # Mongoose database schemas
├── routes/                 # API route definitions
├── services/               # Reusable business logic (email, notifications, etc.)
├── socket/                 # WebSocket server initialization and event handlers
├── utils/                  # Helper functions and utilities
├── server.js               # Entry point of the server application
└── package.json            # Project dependencies and scripts
```

## 🔹 API Documentation (Detailed)

### Authentication API (`/api/auth`)
- **POST `/api/auth/register`**: Register a new user (Customer or Provider). Body: `{ name, email, password, role, ... }`
- **POST `/api/auth/login`**: Authenticate user and return JWT token. Body: `{ email, password }`
- **POST `/api/auth/verify-otp`**: Verify email/phone OTP. Body: `{ email, otp }`
- **POST `/api/auth/forgot-password`**: Request password reset link/OTP.
- **POST `/api/auth/reset-password`**: Set a new password using reset token/OTP.

### Admin API (`/api/admin`)
*(Requires Admin Authentication)*
- **GET `/api/admin/dashboard`**: Fetch aggregate dashboard statistics.
- **GET `/api/admin/users`**: Get all registered users/customers.
- **GET `/api/admin/providers`**: Get all providers (pending/approved).
- **PUT `/api/admin/approve-provider/:id`**: Approve or reject a provider application.
- **GET `/api/admin/bookings`**: View all system bookings.
- **GET `/api/admin/reports`**: Generate earnings and performance reports.

### Provider API (`/api/provider`)
*(Requires Provider Authentication)*
- **GET `/api/provider/dashboard`**: Fetch provider-specific stats.
- **GET `/api/provider/bookings`**: Fetch booking requests assigned to the provider.
- **PUT `/api/provider/bookings/:id/status`**: Update booking status (Accept, Reject, Complete).
- **GET `/api/provider/earnings`**: Fetch provider earnings/payouts.
- **PUT `/api/provider/profile`**: Update provider profile details and documents.

### Customer (User) API (`/api/customer`)
*(Requires Customer Authentication)*
- **GET `/api/customer/profile`**: Get current user profile.
- **PUT `/api/customer/profile`**: Update user profile details.
- **GET `/api/customer/bookings`**: Fetch customer's booking history.

### Services API (`/api/service`)
- **GET `/api/service/`**: List all available services (Public).
- **GET `/api/service/:id`**: Get details of a specific service.
- **POST `/api/service/`**: Create a new service *(Admin only)*.
- **PUT `/api/service/:id`**: Update service details *(Admin only)*.
- **DELETE `/api/service/:id`**: Delete a service *(Admin only)*.

### Booking API (`/api/booking`)
- **POST `/api/booking/`**: Create a new booking *(Customer only)*. Body: `{ serviceId, date, time, address, ... }`
- **GET `/api/booking/:id`**: Get specific booking details.
- **PUT `/api/booking/:id/cancel`**: Cancel a booking.

### Coupon API (`/api/coupon`)
- **POST `/api/coupon/`**: Create a coupon *(Admin only)*.
- **GET `/api/coupon/`**: List active coupons.
- **POST `/api/coupon/apply`**: Apply a coupon to a booking.

### Notifications API (`/api/notifications`)
- **GET `/api/notifications/`**: Fetch user notifications.
- **PUT `/api/notifications/mark-read`**: Mark notifications as read.
- **POST `/api/notifications/send`**: Send manual notification *(Admin only)*.

### Other Modules
- **`/api/transaction`**: Handle and log payment transactions.
- **`/api/complaint`**: Submit and manage user complaints.
- **`/api/feedback`**: Submit and view service/provider reviews.
- **`/api/commission`**: Manage system commission rules *(Admin only)*.
- **`/api/payment`**: Razorpay payment initialization and webhooks.
- **`/api/system-setting`**: Global app settings (banner, logo, etc.) *(Admin only)*.

---

## 🔹 Features Breakdown

- **Authentication System**: Secure JWT-based authentication with OTP verification and password recovery mechanisms.
- **Booking System**: Comprehensive booking lifecycle management (Request -> Assigned -> Accepted -> In Progress -> Completed -> Paid).
- **Payment Handling**: Razorpay integration for secure online payments. Tracks transactions and handles webhooks.
- **Admin Controls**: Full overview of platform metrics, user management, provider verification, category/service management, and commission rule configurations.
- **Provider Management**: Providers can manage their availability, accept/reject booking requests, track earnings, and complete skill tests.
- **Customer Actions**: Browse services, book appointments, apply coupons, leave reviews, and raise complaints.
- **Notifications**: Real-time Socket.io events and Firebase Cloud Messaging (FCM) push notifications for status updates.
- **Reporting & Exports**: Excel and PDF generation for transactions, earnings, and booking reports.

---

## 🔹 Role-Based Features

### Admin:
- Dashboard analytics and trend charts.
- Approve, block, or manage Providers.
- View and manage all Customers.
- Create, Update, Delete Services and Categories.
- Manage Coupons and Commission Rules.
- View all transactions and handle payouts.
- Address complaints and monitor feedback.
- Broadcast push notifications.

### Provider:
- Complete specialized skill tests for approval.
- Manage service bookings (Accept/Decline/Complete).
- Track individual earnings and payout history.
- Update profile and service areas.
- Respond to customer feedback.

### Customer:
- Search and filter available services.
- Book services with selected dates and addresses.
- Apply discount coupons.
- Pay online via Razorpay.
- Rate and review providers.
- Track booking status in real-time.
- File complaints.

---

## 🔹 Database Models

- **User**: Stores Customers and Admins. Fields: `name, email, password, role, address, phone`.
- **Provider**: Stores Provider details. Fields: `userId, skills, experience, documents, isApproved, rating, earnings`.
- **Service**: Stores service catalog. Fields: `name, description, category, price, duration, image`.
- **Booking**: Links Customer, Provider, and Service. Fields: `customerId, providerId, serviceId, status, date, time, totalAmount, paymentStatus`.
- **Transaction**: Payment logs. Fields: `bookingId, amount, paymentId, method, status, type`.
- **Coupon**: Discount codes. Fields: `code, discountType, value, validUntil, maxUses`.
- **CommissionRule**: Platform fee structures. Fields: `category, percentage, fixedAmount`.
- **Complaint**: User issues. Fields: `userId, bookingId, description, status, resolution`.
- **Feedback**: Reviews. Fields: `userId, providerId, serviceId, rating, comment`.
- **Notification**: Alerts. Fields: `userId, title, message, type, isRead`.
- **PaymentRecord**: Payouts to providers. Fields: `providerId, amount, status, processedAt`.

---

## 🔹 Middleware & Security

- **Auth Middleware (`requireAuth`, `isAdmin`, `isProvider`)**: Protects routes by validating JWT and checking user roles.
- **Validation**: Request body validation to ensure data integrity before reaching controllers.
- **CORS Configuration**: Restricts API access to authorized frontend domains.
- **Rate Limiting**: Prevent brute-force attacks and abuse (e.g., `express-rate-limit` on critical endpoints).

---

## 🔹 Future Improvements
- Implement Redis for caching frequently accessed data (like service catalogs and settings).
- Enhance the scheduling logic with calendar syncing (Google Calendar integration).
- Implement a chat module between Customer and Provider using Socket.io.
- Add advanced geolocation-based provider matching.
- Set up automated CI/CD pipelines for deployment.
